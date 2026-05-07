---
name: rp-cli-creator
description: |
  For creators designing and building RP CLI modules. Use this when defining roleplay model schemas with Zod, creating semantic actions, designing named context views, writing migration functions, or structuring a module with defineModule. Trigger whenever the user mentions creating an rp.module.js or rp.module.ts, designing character models, defining actions like remember/setMood, writing views such as world-background or character-speech-style, or building a world model for AI agents. This skill is for the CREATOR side — the person who encodes the world rules and exposes them as a module.
---

# RP CLI Creator Skill

You are helping a creator design and build an RP CLI module. Your job is to guide them through defining the world model, semantic actions, views, and migrations that will later be consumed by AI agents or players via the CLI.

## What RP CLI Is

RP CLI is a Zod-based command-line runtime for persistent story models. As a creator, you define:

- **Model schema** — the shape of your world state (character profiles, moods, memories, inventory, relationships, etc.)
- **Actions** — semantic write operations that agents use to modify state safely
- **Views** — named functions that compress raw model data into domain-specific context
- **Migrations** — functions that upgrade old model files when your schema evolves

The framework handles validation, persistence, action/view result output, and audit logging.

## The Core Pattern: Model-View-Update (MVU)

RP CLI implements the **Model-View-Update** architecture, a unidirectional data flow pattern common in functional UIs:

```
Model (State) -> View (Read) -> Update (Write) -> Model (State) -> ...
```

| MVU Component | RP CLI Equivalent          | Role                                                                    |
| ------------- | -------------------------- | ----------------------------------------------------------------------- |
| **Model**     | `model` in `rp.model.json` | The single source of truth — persistent character/story state           |
| **View**      | `views` in module          | Named functions that project model into domain-specific context         |
| **Update**    | `actions`                  | The normal way to mutate state — actions mutate a validated model clone |

**The critical rule**: Updates are the normal write path. Views should usually be pure projections, but they may intentionally mutate the view model for query side effects; the runtime validates changed models before writing them back. This predictability makes the model reliable for AI agents while still allowing carefully designed read-time behavior.

The `rp.model.json` file on disk is the **authoritative Model**. Actions, low-level patches, and intentional View side effects all go through runtime validation before persistence.

## Module Structure

A module is a JavaScript or TypeScript file that exports `defineModule` from `@rp-cli/core`. Default discovery checks `rp.module.ts` and `rp.module.js`; it prefers TypeScript when the file exists and the current Node.js version can load it directly. Prefer `.js` or `.mjs` for Node.js 20 compatibility. Direct `.ts` or `.mts` module loading requires Node.js 24 or newer.

```javascript
import { defineModule } from "@rp-cli/core";
import { z } from "zod";

export default defineModule({
  name: "my-module",
  version: 1,

  model: {
    version: 1,
    schema: ModelSchema,
    defaults: () => ({ ... }),
    migrate: ({ model, fromVersion, toVersion }) => { ... }
  },

  actions: {
    // semantic write operations
  },

  views: {
    // named context generators
  }
});
```

## Designing the Model Schema

The model schema defines everything that persists between agent turns. Think about what facts need to survive:

| Story concept      | Model field     | Purpose                                        |
| ------------------ | --------------- | ---------------------------------------------- |
| Character identity | `profile`       | Stable canon (name, age, personality)          |
| Emotional state    | `mood`          | Scene-local feelings (label, valence, arousal) |
| Long-term facts    | `memories`      | Pinned important facts                         |
| Relationships      | `relationships` | Per-character relationship data                |
| Numeric state      | `level`, `xp`   | Progress tracking                              |
| Inventory          | `inventory`     | Items a character holds                        |
| Location           | `location`      | Current scene or place                         |

### Schema Best Practices

- Use `z.object()` for structured data
- Use `z.array()` for collections
- Use `.default()` to set sensible defaults
- Use `.optional()` for nullable fields
- Use `.catchall(z.unknown())` for extensibility

```javascript
const ModelSchema = z.object({
  profile: z
    .object({
      name: z.string().optional(),
      age: z.number().optional()
    })
    .catchall(z.unknown())
    .default({}),

  mood: z
    .object({
      label: z.string().optional(),
      valence: z.number().min(-1).max(1).optional()
    })
    .default({}),

  memories: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        pinned: z.boolean().default(false),
        createdAt: z.string()
      })
    )
    .default([])
});
```

## Defining Actions

Actions are the **only** way agents should modify state (besides the JSON Patch escape hatch). Good actions are semantic — they represent story events, not data operations.

### Action Anatomy

```javascript
actions: {
  remember: {
    description: "Add a long-term memory.",
    input: z.object({
      text: z.string(),
      tags: z.array(z.string()).default([]),
      pinned: z.boolean().default(false)
    }),
    run({ model, input, ctx }) {
      model.memories.push({
        id: ctx.id("mem"),
        text: input.text,
        tags: input.tags,
        pinned: input.pinned,
        createdAt: ctx.now()
      });

      return {
        reason: "A long-term memory was added.",
        result: "Memory recorded."
      };
    }
  }
}
```

### Key Action Principles

1. **Mutate `model` directly** — actions receive a safe mutable clone that the framework validates before persistence
2. **Use `ctx.id(prefix)`** to generate unique IDs
3. **Use `ctx.now()`** for timestamps (ISO 8601 format)
4. **Include a `reason`** explaining why (goes to audit log, not model)
5. **Return a `result`** for CLI output when the user should see confirmation or data

### Good Action Examples

- `setMood` — updates emotional state after scene beats
- `remember` — adds pinned facts to memory
- `advanceQuest` — progresses a storyline
- `gainItem` / `loseItem` — inventory management
- `changeRelationship` — updates trust/affection between characters
- `levelUp` — increases experience/level

### Low-Level JSON Patch Escape Hatch

Actions should stay semantic and mutate `model` directly. `rp update '<json-patch>'` still exists for debugging, migration support, and rare low-level edits.

## Defining Views

Views are named functions that compress model data into useful context. Agents call views before generating responses to understand the current situation. Keep views pure by default, and only use state mutation when a query side effect is genuinely part of the design.

```javascript
views: {
  summary({ model }) {
    return {
      result: {
        profile: model.profile,
        mood: model.mood,
        pinnedMemories: model.memories.filter(m => m.pinned)
      }
    };
  },

  characterBackground({ model }) {
    return {
      result: {
        character: model.profile,
        currentMood: model.mood.label,
        importantFacts: model.memories.filter(m => m.pinned).map(m => m.text)
      }
    };
  }
}
```

### View Principles

1. **Prefer pure projections** — most views should only read model data
2. **Return `result` with whatever structure makes sense** — view result payloads aren't validated by Zod
3. **Curate for the agent** — think about what context matters for the next response
4. **Use meaningful names** — `world-background`, `mio-speech-style`, `summary`, `current-mood`
5. **Use side effects deliberately** — if a view mutates model data, keep it small and schema-valid

## Handling Schema Evolution with Migrations

When your schema changes, existing model files need to be migrated. The migrate function transforms old model data to match the new schema.

```javascript
model: {
  version: 2,  // increment when schema changes
  schema: NewModelSchema,
  defaults: () => ({ ... }),
  migrate: ({ model, fromVersion, toVersion, ctx }) => {
    if (fromVersion === 1) {
      // Transform v1 model to v2 structure
      return {
        ...model,
        // v2 changes: add new fields, restructure, etc.
      };
    }
    throw new Error(`Unknown migration: ${fromVersion} -> ${toVersion}`);
  }
}
```

### Migration Principles

1. **Always increment `model.version`** when schema changes
2. **Handle all previous versions** in the migrate function
3. **Return the migrated model** — the framework validates it against the new schema
4. **Log migration** happens automatically

## The Model Envelope

When you call `rp init`, the framework creates an envelope file:

```json
{
  "rp": {
    "module": "my-module",
    "moduleVersion": 1,
    "schemaVersion": 1,
    "createdAt": "2026-05-04T00:00:00.000Z",
    "updatedAt": "2026-05-04T00:00:00.000Z"
  },
  "model": {
    // your model data
  }
}
```

**Critical rule**: Actions and patches can ONLY modify `model`, never `rp`. The framework maintains `rp` metadata.

## Directory Structure for Multi-Character Modules

For projects with multiple characters, organize like the life-sim example:

```
my-module/
├── package.json          # Contains "type": "module"
├── src/
│   └── rp.module.js      # Shared module definition
├── character1/
│   ├── rp.module.js@     # symlink -> ../src/rp.module.js
│   └── rp.model.json     # Character state
└── character2/
    ├── rp.module.js@
    └── rp.model.json
```

This allows agents to work on different characters without specifying `--module` each time.

## Discovery — Helping Agents Find Capabilities

Agents need to discover what your module supports. Always ensure:

```bash
rp action --list      # What actions exist
rp view --list       # What views exist
rp model --schema    # What the model looks like
rp action <name> --schema  # What inputs an action expects
```

## Common Pitfalls to Avoid

1. **Don't expose raw JSON Patch in actions** — use semantic action names and direct model mutation
2. **Don't validate view result payloads** — views return arbitrary JSON inside `result`
3. **Don't hide major state changes in views** — use actions for intentional story events
4. **Don't forget to increment version** — when schema changes
5. **Don't skip `--reason`** in examples — it models good agent behavior

## Quick Reference: defineModule Fields

| Field              | Required | Description                              |
| ------------------ | -------- | ---------------------------------------- |
| `name`             | Yes      | Module identifier string                 |
| `version`          | Yes      | Module version number                    |
| `model.version`    | Yes      | Schema version (increment on changes)    |
| `model.schema`     | Yes      | Zod schema for model validation          |
| `model.defaults()` | Yes      | Factory function returning initial state |
| `model.migrate`    | No       | Upgrade function for old schema versions |
| `actions.*`        | No       | Semantic write operations                |
| `views.*`          | No       | Named context generators                 |

## Getting Started Checklist

1. Import `defineModule` from `@rp-cli/core` and `z` from `zod`
2. Design your model schema — what state needs persistence?
3. Define 2-5 core actions — what story events modify state?
4. Create 1-2 views — what context does an agent need?
5. Test with `rp init`, `rp action`, `rp view`
6. Plan migrations for future schema versions

## Example: A Minimal But Complete Module

```javascript
import { defineModule } from "@rp-cli/core";
import { z } from "zod";

const ModelSchema = z.object({
  name: z.string().default("Unknown"),
  mood: z
    .object({
      label: z.string().default("neutral"),
      energy: z.number().min(0).max(100).default(50)
    })
    .default({}),
  memories: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        importance: z.number().min(1).max(5).default(3)
      })
    )
    .default([])
});

export default defineModule({
  name: "simple-char",
  version: 1,

  model: {
    version: 1,
    schema: ModelSchema,
    defaults: () => ({ name: "Unknown", mood: {}, memories: [] }),
    migrate: ({ model }) => model
  },

  actions: {
    setMood: {
      description: "Update the character's emotional state.",
      input: z.object({
        label: z.string(),
        energy: z.number().optional()
      }),
      run({ model, input }) {
        model.mood.label = input.label;
        if (input.energy !== undefined) {
          model.mood.energy = input.energy;
        }
        return {
          reason: `Mood changed to ${input.label}.`,
          result: "Mood updated."
        };
      }
    }
  },

  views: {
    summary({ model }) {
      return {
        result: {
          name: model.name,
          mood: model.mood,
          memoryCount: model.memories.length
        }
      };
    }
  }
});
```
