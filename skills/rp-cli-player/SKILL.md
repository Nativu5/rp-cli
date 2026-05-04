---
name: rp-cli-player
description: |
  For AI agents and players conducting roleplay sessions with RP CLI modules. Use this when running rp commands like init, validate, migrate, action, view, update, model, or log in a roleplay context — managing characters, tracking story events, recording memories, updating emotional states, and maintaining narrative continuity across scenes. Trigger whenever the user wants to: run an action (remember, setMood, etc.), read a view (prompt, default), apply JSON Patch updates, check character state, validate a character file, or inspect audit logs during roleplay. This skill is for the PLAYER/AGENT side — the consumer who embodies characters and modifies story state through the CLI.
---

# RP CLI Player Skill

You are an AI agent or player conducting roleplay sessions. Your job is to **be the character** — reading their context, responding to events, and updating their state to maintain continuity across scenes. Think of RP CLI as your character's memory and the CLI as your way of "taking notes" that never get lost.

## What RP CLI Is

RP CLI is a **roleplay memory runtime** — it maintains the persistent state of characters and story worlds between scenes. As a player/agent, you don't design the module — you **inhabit** it. The creator defined:

- **Model schema** — what state exists (character profile, mood, memories, relationships, etc.)
- **Actions** — safe semantic operations to modify state (e.g., "remember this," "change mood")
- **Views** — read-only summaries that tell you who the character is right now

You interact exclusively through the `rp` CLI commands.

## The Architecture: Model-View-Update

RP CLI follows the **Model-View-Update (MVU)** pattern:

```
rp.model.json (Model) --> rp view (View) --> You read context
                                        |
You write action --> rp action (Update) --> rp.model.json (Model)
```

| Component                   | What it does                                                    |
| --------------------------- | --------------------------------------------------------------- |
| **Model** (`rp.model.json`) | The single source of truth — character state on disk            |
| **View** (`rp view`)        | Projects model into a context summary for you to read           |
| **Update** (`rp action`)    | Records what happened — produces a patch that updates the model |

The key insight: you never read or write the model file directly. You **view** it for context, and you **update** it through structured actions. This keeps the character state coherent across scenes.

## Core Workflow

```
1. Before a scene:   rp view prompt     # Get character context
2. After an event:   rp action <name>   # Record what happened
3. When unsure:       rp action --list   # Discover available actions
4. To audit:          rp log --limit 5  # See recent changes
```

## Essential Commands

### Reading Context

```bash
# Get prompt-ready context (the most important view)
rp view prompt

# Get general overview
rp view

# List all available views
rp view --list

# Get raw model data (pipe to jq for filtering)
rp model
rp model | jq '.memories[] | select(.pinned == true)'

# Get full envelope (includes rp metadata)
rp model --raw
```

### Writing State via Actions

```bash
# Call a semantic action — THIS IS PREFERRED over raw patches
rp action remember '{"text":"Mio dislikes thunderstorms.","pinned":true}' \
  --reason "Mio expressed fear of thunder during the conversation."

rp action setMood '{"label":"anxious","valence":-0.3,"arousal":0.7}' \
  --reason "The sudden noise made Mio nervous."

rp action advanceQuest '{"questId":"main-3","step":5}' \
  --reason "Mio completed the delivery task."
```

### Low-Level Updates (Escape Hatch)

When no semantic action exists, use JSON Patch directly:

```bash
rp update '[{"op":"replace","path":"/mood/label","value":"calm"}]' \
  --reason "The scene transitioned to a quiet moment."
```

**Rule**: Prefer semantic actions. Use `rp update` only when no action fits.

### Discovering Capabilities

```bash
# What actions can I call?
rp action --list

# What does an action need as input?
rp action remember --schema

# What does the model look like?
rp model --schema
```

### Validation and Maintenance

```bash
# Validate the current model file
rp validate

# Migrate if the schema has evolved
rp migrate

# Check audit logs
rp log --limit 10
```

## The --reason Flag

**Always use `--reason` with write operations.** It explains _why_ the change happened and is stored in the audit log, not in the model. This helps creators debug, agents understand history, and maintains story continuity.

```bash
rp action setMood '{"label":"happy"}' --reason "Mio just received good news."
```

## Path Convention for JSON Patch

Patch paths are **relative to the model root** (not the envelope):

```bash
# This modifies model.mood.label
rp update '[{"op":"replace","path":"/mood/label","value":"happy"}]'

# This adds to model.memories array
rp update '[{"op":"add","path":"/memories/-","value":{"id":"mem_1","text":"..."}}]'
```

## Path Resolution and Defaults

RP CLI resolves module and model paths in this order:

```
CLI arguments > environment variables > default paths
```

| Source      | Module            | Model             |
| ----------- | ----------------- | ----------------- |
| CLI         | `--module <path>` | `--model <path>`  |
| Environment | `RP_MODULE`       | `RP_MODEL`        |
| Default     | `./rp.module.ts`  | `./rp.model.json` |

For working with a character in its own directory, set once:

```bash
export RP_DIR=./characters/mio
# or
export RP_MODULE=./src/rp.module.ts
export RP_MODEL=./characters/mio/rp.model.json

# Now all commands are concise:
rp view prompt
rp action setMood '{"label":"sleepy"}'
rp log --limit 3
```

## Working Across Multiple Characters

```bash
# Target a specific character without changing directory
rp --dir characters/mio action setMood '{"label":"happy"}'
rp --dir characters/yuki action setMood '{"label":"energetic"}'

# Or use explicit paths
rp --model characters/mio/rp.model.json --module src/rp.module.ts view
```

## Model File Structure

The model file is an envelope containing both framework metadata and your data:

```json
{
  "rp": {
    "module": "life-sim",
    "moduleVersion": 1,
    "schemaVersion": 1,
    "createdAt": "2026-05-04T00:00:00.000Z",
    "updatedAt": "2026-05-04T00:00:00.000Z"
  },
  "model": {
    "profile": { "name": "Mio" },
    "mood": { "label": "happy", "valence": 0.8 },
    "memories": []
  }
}
```

**Important**: You can only modify `model`. The `rp` metadata is maintained by the framework.

## Common Workflows

### Scene Preparation

```bash
# Get full context before writing
rp view prompt

# If you need the raw model for jq filtering
rp model | jq '.memories[] | select(.pinned == true)'
```

### After a Meaningful Event

```bash
# Record a new fact
rp action remember '{"text":"Mio and Haru made a promise to meet at the library.","pinned":true}' \
  --reason "Mio and Haru agreed to meet tomorrow."

# Update emotional state
rp action setMood '{"label":"melancholy","valence":-0.4}' \
  --reason "Mio remembered her grandmother's old stories."
```

### When State Gets Out of Sync

```bash
# Check if validation passes
rp validate

# Migrate if needed
rp migrate
```

### Auditing Recent Changes

```bash
# See last 5 operations
rp log --limit 5

# Look for a specific event
rp log --limit 20 | jq '.[] | select(.type == "action")'
```

## Error Handling

RP CLI returns structured errors. If you see an error:

```json
{
  "error": {
    "code": "ACTION_INPUT_INVALID",
    "message": "invalid input for action: remember",
    "details": {
      "issues": [{ "path": "/text", "message": "Required" }]
    }
  }
}
```

Common error codes:

- `ACTION_NOT_FOUND` — action doesn't exist, check `rp action --list`
- `ACTION_INPUT_INVALID` — malformed input, check `rp action <name> --schema`
- `MODEL_VALIDATION_ERROR` — state would become invalid
- `MIGRATION_REQUIRED` — run `rp migrate` first
- `PATCH_INVALID` — bad JSON Patch syntax

## Best Practices

1. **Always use `--reason`** — it makes audit trails meaningful
2. **Prefer semantic actions** over raw patches when available
3. **Call views before scenes** — understand context before writing
4. **Validate after direct patches** — ensure schema compliance
5. **Use `jq` for filtering** — don't expect RP CLI to filter data
6. **Check `--list` first** — discover before assuming

## Quick Reference

| Task           | Command                                            |
| -------------- | -------------------------------------------------- |
| Get context    | `rp view prompt`                                   |
| Record event   | `rp action <name> '<json>' --reason "..."`         |
| Low-level edit | `rp update '<json-patch>' --reason "..."`          |
| List actions   | `rp action --list`                                 |
| List views     | `rp view --list`                                   |
| Raw model      | `rp model \| jq '...'`                             |
| Validate       | `rp validate`                                      |
| Migrate        | `rp migrate`                                       |
| Audit log      | `rp log --limit 5`                                 |
| Get schemas    | `rp model --schema` or `rp action <name> --schema` |

## Example: A Full Agent Turn

```bash
# 1. Agent prepares — get character context
$ rp view prompt
{
  "character": { "name": "Mio" },
  "currentMood": { "label": "curious", "valence": 0.2 },
  "importantFacts": ["Mio likes rainy afternoons."]
}

# 2. Scene happens, agent records it
$ rp action remember '{"text":"Mio met Haru at the library today.","pinned":true}' \
  --reason "Mio and Haru had their first real conversation."
{"ok": true, "message": "Memory recorded."}

# 3. Update mood to reflect the positive interaction
$ rp action setMood '{"label":"happy","valence":0.6}' \
  --reason "The conversation with Haru went well."
{"ok": true, "message": "Mood updated."}

# 4. Audit to verify
$ rp log --limit 3
{"id":"log_001","type":"action","name":"remember",...}
{"id":"log_002","type":"action","name":"setMood",...}
```
