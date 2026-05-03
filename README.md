# RP CLI

RP CLI is a Zod-based command line state runtime for AI agents.

It gives creators a small, typed runtime for persistent story state. A creator defines the shape of the world and the semantic operations that are allowed. An agent uses the CLI to read context, call actions, apply patches when necessary, migrate state, and inspect audit logs.

## Roles

RP CLI has two primary audiences.

**Creators** design the module:

- define the story state with Zod
- provide default state
- write migrations when the schema changes
- expose semantic actions such as `remember`, `setMood`, or `advanceQuest`
- expose summaries that turn raw state into useful agent context

**Users and agents** run the CLI:

- initialize and validate state files
- ask for summaries before writing a scene
- call semantic actions after meaningful events
- use JSON Patch for low-level edits
- inspect logs to understand why state changed

The intended workflow is simple: creators encode the world model once, then agents interact with it through stable CLI commands.

## Features

- Zod state schemas for creator-defined worlds.
- State initialization, validation, and schema migration.
- Typed semantic actions for safe writes.
- Standard JSON Patch support for escape-hatch edits.
- Read-only summaries for prompt/context generation.
- JSON Schema export for state and action inputs.
- JSONL audit logs with reasons, patches, and state hashes.

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
rp --module examples/life-sim/rp.module.ts --state mio.json init
```

Add a pinned memory:

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json \
  --reason "User established this preference." \
  action remember '{"text":"Mio likes rainy afternoons.","tags":["preference"],"pinned":true}'
```

Update the current mood:

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json \
  --reason "The scene shifted into a calmer beat." \
  action setMood '{"label":"calm","valence":0.45,"arousal":0.2}'
```

Read a prompt-oriented summary:

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json summary prompt
```

Inspect recent writes:

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json log --limit 5
```

## Default Paths And Environment Variables

RP CLI can run without explicit `--module` and `--state` arguments when conventional paths or environment variables are available.

Path resolution priority:

```text
CLI arguments > environment variables > default paths
```

| Source                | Module path       | State path        |
| --------------------- | ----------------- | ----------------- |
| CLI arguments         | `--module <path>` | `--state <path>`  |
| Environment variables | `RP_MODULE`       | `RP_STATE`        |
| Default paths         | `./rp.module.ts`  | `./rp.state.json` |

If the current working directory contains `rp.module.ts` and `rp.state.json`, an agent can call:

```bash
rp summary
rp action remember '{"text":"Mio likes rain."}'
rp state
```

For a module elsewhere, set environment variables once for the session:

```bash
export RP_MODULE=examples/life-sim/rp.module.ts
export RP_STATE=mio.json

rp init
rp action remember '{"text":"Mio likes rain.","pinned":true}'
rp summary prompt
rp log --limit 5
```

You can also mix explicit arguments with defaults. For example, keep a default module but choose a state file per character:

```bash
export RP_MODULE=examples/life-sim/rp.module.ts

rp --state mio.json init
rp --state mio.json summary
```

Configuration files such as `rp.config.json` or `rp.config.ts` are not currently part of the runtime. The supported configuration surface is CLI arguments, `RP_MODULE` / `RP_STATE`, and the default paths above.

## Authoring A Module

An RP module exports `defineModule(...)` from `@rp-cli/core`.

```ts
import { defineModule } from "@rp-cli/core";
import { z } from "zod";

const StateSchema = z.object({
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
  state: {
    version: 1,
    schema: StateSchema,
    defaults: () => ({ memories: [] }),
    migrate: ({ state }) => StateSchema.parse(state)
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
  summaries: {
    default({ state }) {
      return {
        pinnedMemories: state.memories.filter((memory) => memory.pinned)
      };
    }
  }
});
```

## How RP CLI Helps Story Creation

RP CLI does not prescribe a game genre or a story model. Instead, it gives creators a way to formalize the parts of a narrative world that should persist between agent turns.

- Put stable canon in `state`: profile, relationships, inventory, quests, memories, location, mood, or any creator-defined structure.
- Put meaningful state transitions in `actions`: remember a fact, update mood, change relationship trust, advance a quest, spend an item.
- Put prompt-facing views in `summaries`: compress raw state into the exact context an agent needs for the next response.
- Use `--reason` and logs to preserve why a change happened, not only what changed.
- Use migrations when the story model grows and older state files need to be upgraded.

This separates creative design from runtime mechanics. The creator owns the world rules; the agent gets a reliable tool interface.

## CLI Commands

| Command                   | Purpose                                                  |
| ------------------------- | -------------------------------------------------------- |
| `rp init`                 | Create a state file from module defaults.                |
| `rp validate`             | Validate the current state file and schema version.      |
| `rp state`                | Output author state. Use `--raw` for the full envelope.  |
| `rp patch <json>`         | Apply JSON Patch to author state.                        |
| `rp action <name> <json>` | Run a semantic write action.                             |
| `rp action --list`        | List available actions.                                  |
| `rp summary [name]`       | Run a read-only summary.                                 |
| `rp summary --list`       | List available summaries.                                |
| `rp migrate`              | Migrate an old state file to the current schema version. |
| `rp schema [state]`       | Export the state schema as JSON Schema.                  |
| `rp schema action <name>` | Export an action input schema as JSON Schema.            |
| `rp log --limit <n>`      | Read JSONL audit logs.                                   |

## State Files

State files are stored as an envelope:

```json
{
  "rp": {
    "module": "example",
    "moduleVersion": 1,
    "schemaVersion": 1,
    "createdAt": "2026-05-04T00:00:00.000Z",
    "updatedAt": "2026-05-04T00:00:00.000Z"
  },
  "state": {
    "memories": []
  }
}
```

Actions and patches can only modify `state`. Runtime metadata under `rp` is maintained by the framework.

State files are bound to a module by `rp.module`. If a command loads a module
whose `name` differs from the state file's `rp.module`, RP CLI returns
`MODULE_STATE_MISMATCH` instead of validating or writing the file. Schema
evolution is still controlled by `rp.schemaVersion`.

Action and summary handlers receive a deep-frozen clone of author state. Direct
mutation inside creator code fails at runtime; writes must be expressed as JSON
Patch operations returned by actions or passed to `rp patch`.

## JSON Patch

`rp patch` accepts standard JSON Patch arrays. Patch paths are relative to the author state root, not to the full envelope.

```bash
rp patch '[{"op":"add","path":"/memories/-","value":{"id":"mem_1","text":"Mio likes rain.","pinned":true,"createdAt":"2026-05-04T00:00:00.000Z"}}]'
```

The patched state must pass the module Zod schema before it is written.

## Audit Logs

Write commands append JSONL entries to:

```text
<state-file>.log.jsonl
```

Logs include the operation type, reason, patch, action metadata when available, and state hashes before and after the write.

```bash
rp log --limit 5
```

`--reason` is written to the audit log and is not stored in author state.

## Write Locking

Write commands use `proper-lockfile` to guard the state file. The lock path is
`<state-file>.lock`, implemented as an atomic lock directory with mtime-based
stale detection. RP CLI briefly retries active locks and recovers stale locks
before returning `STATE_LOCKED`.

## Example Module

The repository includes a life-sim module:

```text
examples/life-sim/rp.module.ts
```

It demonstrates how a creator can turn character design into state, turn story events into actions, and turn state into prompt-ready summaries.

See [examples/life-sim/README.md](examples/life-sim/README.md) for the full example workflow.

## Development

```bash
npm install
npm run typecheck
npm test
npm run lint
npm run build
```
