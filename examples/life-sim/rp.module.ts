import { defineModule } from "@rp-cli/core";
import { z } from "zod";

// Memories are durable story facts the agent should be able to recall later.
const MemorySchema = z.object({
  id: z.string(),
  text: z.string(),
  tags: z.array(z.string()).default([]),
  pinned: z.boolean().default(false),
  createdAt: z.string()
});

// The state schema is the creator's world model: character canon, current scene signals,
// relationship state, and long-term memory.
const StateSchema = z.object({
  profile: z
    .object({
      name: z.string().optional(),
      age: z.number().optional(),
      personality: z.array(z.string()).optional()
    })
    .catchall(z.unknown())
    .default({}),
  mood: z
    .object({
      label: z.string().optional(),
      valence: z.number().min(-1).max(1).optional(),
      arousal: z.number().min(0).max(1).optional(),
      stress: z.number().min(0).max(1).optional()
    })
    .catchall(z.unknown())
    .default({}),
  relationships: z
    .record(
      z.string(),
      z
        .object({
          affection: z.number().min(0).max(100).optional(),
          trust: z.number().min(0).max(100).optional(),
          notes: z.array(z.string()).default([])
        })
        .catchall(z.unknown())
    )
    .default({}),
  memories: z.array(MemorySchema).default([])
});

export default defineModule({
  name: "life-sim",
  version: 1,
  state: {
    version: 1,
    schema: StateSchema,
    // Defaults describe a new save file before the story has accumulated canon.
    defaults: () => ({
      profile: {},
      mood: {},
      relationships: {},
      memories: []
    }),
    // Migration keeps older save files usable when the creator evolves the schema.
    migrate: ({ state }) => StateSchema.parse(state)
  },
  actions: {
    remember: {
      description: "Add a long-term memory.",
      input: z.object({
        text: z.string(),
        tags: z.array(z.string()).default([]),
        pinned: z.boolean().default(false)
      }),
      run({ input, ctx }) {
        // Actions return JSON Patch; the runtime applies, validates, writes, and logs it.
        return {
          patch: [
            {
              op: "add",
              path: "/memories/-",
              value: {
                id: ctx.id("mem"),
                text: input.text,
                tags: input.tags,
                pinned: input.pinned,
                createdAt: ctx.now()
              }
            }
          ],
          reason: "A long-term memory was added.",
          message: "Memory recorded."
        };
      }
    },
    setMood: {
      description: "Update current mood.",
      input: z.object({
        label: z.string().optional(),
        valence: z.number().min(-1).max(1).optional(),
        arousal: z.number().min(0).max(1).optional(),
        stress: z.number().min(0).max(1).optional()
      }),
      run({ input }) {
        // Mood updates are semantic writes, so agents do not need to know raw patch paths.
        return {
          patch: Object.entries(input).map(([key, value]) => ({
            op: "add",
            path: `/mood/${key}`,
            value
          })),
          reason: "Mood fields were updated.",
          message: "Mood updated."
        };
      }
    }
  },
  summaries: {
    default({ state }) {
      // Summaries are read-only views for agents; they do not need to mirror raw state.
      return {
        profile: state.profile,
        mood: state.mood,
        relationshipCount: Object.keys(state.relationships).length,
        pinnedMemories: state.memories.filter((memory) => memory.pinned)
      };
    },
    prompt({ state }) {
      // The prompt summary shapes state into compact context for the next generated scene.
      return {
        character: state.profile,
        currentMood: state.mood,
        importantMemories: state.memories
          .filter((memory) => memory.pinned)
          .map((memory) => memory.text)
      };
    }
  }
});
