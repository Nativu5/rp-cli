# RP CLI

RP CLI is a Zod-based command line model runtime for AI agents.

It gives creators a small, typed runtime for persistent story models. A creator defines the shape of the world and the semantic operations that are allowed. An agent uses the CLI to read context, call actions, apply JSON Patch updates when necessary, migrate model files, and inspect audit logs.

## Roles

RP CLI has two primary audiences.

**Creators** design the module:

- define the story model with Zod
- provide default model data
- write migrations when the schema changes
- expose semantic actions such as `remember`, `setMood`, or `advanceQuest`
- expose views that turn raw model data into useful agent context

**Users and agents** run the CLI:

- initialize and validate model files
- ask for views before writing a scene
- call semantic actions after meaningful events
- use JSON Patch for low-level edits
- inspect logs to understand why model data changed

The intended workflow is simple: creators encode the world model once, then agents interact with it through stable CLI commands.

## Features

- Zod model schemas for creator-defined worlds.
- Model initialization, validation, and schema migration.
- Typed semantic actions for safe writes.
- Standard JSON Patch support for escape-hatch edits.
- Read-only views for prompt/context generation.
- JSON Schema export for model and action inputs.
- JSONL audit logs with reasons, patches, and model hashes.

## Installation

The examples below assume the `rp` executable is available in your shell.

For local development in this repository:

```bash
npm install
npm run build
```

Runtime module loading currently targets Node `>=24.0.0`. Supported local module
file extensions are `.ts`, `.mts`, `.js`, `.mjs`, and `.cjs`; other extensions
are rejected before import with a `MODULE_INVALID` error.

## Quick Start

Run the bundled life-sim example:

```bash
rp --module examples/life-sim/rp.module.ts --model mio.json init
```

Add a pinned memory:

```bash
rp --module examples/life-sim/rp.module.ts --model mio.json \
  --reason "User established this preference." \
  action remember '{"text":"Mio likes rainy afternoons.","tags":["preference"],"pinned":true}'
```

Update the current mood:

```bash
rp --module examples/life-sim/rp.module.ts --model mio.json \
  --reason "The scene shifted into a calmer beat." \
  action setMood '{"label":"calm","valence":0.45,"arousal":0.2}'
```

Read a prompt-oriented view:

```bash
rp --module examples/life-sim/rp.module.ts --model mio.json view prompt
```

Inspect recent writes:

```bash
rp --module examples/life-sim/rp.module.ts --model mio.json log --limit 5
```

## Default Paths And Environment Variables

RP CLI can run without explicit `--module` and `--model` arguments when conventional paths or environment variables are available.

Path resolution priority:

```text
CLI arguments > environment variables > default paths
```

| Source                | Module path       | Model path        |
| --------------------- | ----------------- | ----------------- |
| CLI arguments         | `--module <path>` | `--model <path>`  |
| Environment variables | `RP_MODULE`       | `RP_MODEL`        |
| Default paths         | `./rp.module.ts`  | `./rp.model.json` |

If the current working directory contains `rp.module.ts` and `rp.model.json`, an agent can call:

```bash
rp view
rp action remember '{"text":"Mio likes rain."}'
rp model
```

For a module elsewhere, set environment variables once for the session:

```bash
export RP_MODULE=examples/life-sim/rp.module.ts
export RP_MODEL=mio.json

rp init
rp action remember '{"text":"Mio likes rain.","pinned":true}'
rp view prompt
rp log --limit 5
```

You can also mix explicit arguments with defaults. For example, keep a default module but choose a model file per character:

```bash
export RP_MODULE=examples/life-sim/rp.module.ts

rp --model mio.json init
rp --model mio.json view
```

Configuration files such as `rp.config.json` or `rp.config.ts` are not currently part of the runtime. The supported configuration surface is CLI arguments, `RP_MODULE` / `RP_MODEL`, and the default paths above.

## Authoring A Module

An RP module exports `defineModule(...)` from `@rp-cli/core`.

```ts
import { defineModule } from "@rp-cli/core";
import { z } from "zod";

const ModelSchema = z.object({
  memories: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      pinned: z.boolean().default(false),
      createdAt: z.string()
    })
  )
});

export default defineModule({
  name: "example",
  version: 1,
  model: {
    version: 1,
    schema: ModelSchema,
    defaults: () => ({ memories: [] }),
    migrate: ({ model }) => ModelSchema.parse(model)
  },
  actions: {
    remember: {
      description: "Add a memory.",
      input: z.object({
        text: z.string(),
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
                pinned: input.pinned,
                createdAt: ctx.now()
              }
            }
          ],
          reason: "A memory was added.",
          message: "Memory recorded."
        };
      }
    }
  },
  views: {
    default({ model }) {
      return {
        pinnedMemories: model.memories.filter((memory) => memory.pinned)
      };
    }
  }
});
```

## How RP CLI Helps Story Creation

RP CLI does not prescribe a game genre or a story model. Instead, it gives creators a way to formalize the parts of a narrative world that should persist between agent turns.

- Put stable canon in `model`: profile, relationships, inventory, quests, memories, location, mood, or any creator-defined structure.
- Put meaningful model transitions in `actions`: remember a fact, update mood, change relationship trust, advance a quest, spend an item.
- Put prompt-facing views in `views`: compress raw model data into the exact context an agent needs for the next response.
- Use `--reason` and logs to preserve why a change happened, not only what changed.
- Use migrations when the story model grows and older model files need to be upgraded.

This separates creative design from runtime mechanics. The creator owns the world rules; the agent gets a reliable tool interface.

## CLI Commands

| Command                     | Purpose                                                  |
| --------------------------- | -------------------------------------------------------- |
| `rp init`                   | Create a model file from module defaults.                |
| `rp validate`               | Validate the current model file and schema version.      |
| `rp model`                  | Output author model. Use `--raw` for the full envelope.  |
| `rp update <json>`          | Apply JSON Patch to author model.                        |
| `rp action <name> <json>`   | Run a semantic write action.                             |
| `rp action --list`          | List available actions.                                  |
| `rp view [name]`            | Run a read-only view.                                    |
| `rp view --list`            | List available views.                                    |
| `rp migrate`                | Migrate an old model file to the current schema version. |
| `rp model --schema`         | Export the model schema as JSON Schema.                  |
| `rp action <name> --schema` | Export an action input schema as JSON Schema.            |
| `rp log --limit <n>`        | Read JSONL audit logs.                                   |

## Model Files

Model files are stored as an envelope:

```json
{
  "rp": {
    "module": "example",
    "moduleVersion": 1,
    "schemaVersion": 1,
    "createdAt": "2026-05-04T00:00:00.000Z",
    "updatedAt": "2026-05-04T00:00:00.000Z"
  },
  "model": {
    "memories": []
  }
}
```

Actions and raw updates can only modify `model`. Runtime metadata under `rp` is maintained by the framework.

Model files are bound to a module by `rp.module`. If a command loads a module
whose `name` differs from the model file's `rp.module`, RP CLI returns
`MODULE_MODEL_MISMATCH` instead of validating or writing the file. Schema
evolution is still controlled by `rp.schemaVersion`.

Action and view handlers receive a deep-frozen clone of author model data. Direct
mutation inside creator code fails at runtime; writes must be expressed as JSON
Patch operations returned by actions or passed to `rp update`.

## JSON Patch

`rp update` accepts standard JSON Patch arrays. Patch paths are relative to the author model root, not to the full envelope.

```bash
rp update '[{"op":"add","path":"/memories/-","value":{"id":"mem_1","text":"Mio likes rain.","pinned":true,"createdAt":"2026-05-04T00:00:00.000Z"}}]'
```

The patched model must pass the module Zod schema before it is written.

## Audit Logs

Write commands append JSONL entries to:

```text
<model-file>.log.jsonl
```

Logs include the operation type, reason, patch, action metadata when available, and model hashes before and after the write.

```bash
rp log --limit 5
```

`--reason` is written to the audit log and is not stored in author model data.

## Write Locking

Write commands use `proper-lockfile` to guard the model file. The lock path is
`<model-file>.lock`, implemented as an atomic lock directory with mtime-based
stale detection. RP CLI briefly retries active locks and recovers stale locks
before returning `MODEL_LOCKED`.

## Example Module

The repository includes a life-sim module:

```text
examples/life-sim/rp.module.ts
```

It demonstrates how a creator can turn character design into a model, turn story events into actions, and turn model data into prompt-ready views.

See [examples/life-sim/README.md](examples/life-sim/README.md) for the full example workflow.

## Development

```bash
npm install
npm run typecheck
npm test
npm run lint
npm run build
```
