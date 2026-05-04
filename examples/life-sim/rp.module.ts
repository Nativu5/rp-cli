import { defineModule } from "@rp-cli/core";
import {} from "@rp-cli/core";
import { z } from "zod";

// Memories are durable story facts the agent should be able to recall later.
const MemorySchema = z.object({
  id: z.string(),
  text: z.string(),
  tags: z.array(z.string()).default([]),
  pinned: z.boolean().default(false),
  createdAt: z.string()
});

// The model schema is the creator's world model: character canon, current scene signals,
// relationships, and long-term memory.
const ModelSchema = z.object({
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
  model: {
    version: 1,
    schema: ModelSchema,
    // Defaults describe a new save file before the story has accumulated canon.
    defaults: () => ({
      profile: {},
      mood: {},
      relationships: {},
      memories: []
    }),
    // Migration keeps older save files usable when the creator evolves the schema.
    migrate: ({ model }) => ModelSchema.parse(model)
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
  views: {
    default({ model }) {
      // Views are read-only projections for agents; they do not need to mirror raw model.
      return {
        profile: model.profile,
        mood: model.mood,
        relationshipCount: Object.keys(model.relationships).length,
        pinnedMemories: model.memories.filter((memory) => memory.pinned)
      };
    },
    prompt({ model }) {
      // The prompt view shapes model data into compact context for the next generated scene.
      return {
        character: model.profile,
        currentMood: model.mood,
        importantMemories: model.memories.filter((memory) => memory.pinned).map((memory) => memory.text)
      };
    }
  }
});
