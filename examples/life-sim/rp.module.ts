import { defineModule } from "@rp-cli/core";
import { z } from "zod";

const MemorySchema = z.object({
  id: z.string(),
  text: z.string(),
  tags: z.array(z.string()).default([]),
  pinned: z.boolean().default(false),
  createdAt: z.string()
});

const StateSchema = z.object({
  profile: z.object({}).catchall(z.unknown()).default({}),
  mood: z.object({}).catchall(z.unknown()).default({}),
  relationships: z
    .record(
      z.string(),
      z
        .object({
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
    defaults: () => ({
      profile: {},
      mood: {},
      relationships: {},
      memories: []
    }),
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
    }
  },
  summaries: {
    default({ state }) {
      return {
        profile: state.profile,
        mood: state.mood,
        pinnedMemories: state.memories.filter((memory) => memory.pinned)
      };
    }
  }
});
