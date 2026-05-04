# Life Sim Example

This example shows how a creator can use RP CLI to turn character and story design into a reliable model tool for agents.

The module is intentionally small. It is not a complete game engine. It demonstrates the core pattern:

```text
creator design -> Zod model schema -> semantic actions -> prompt views -> CLI usage by agents
```

## The Creative Idea

Imagine a slice-of-life roleplay centered on Mio. The agent needs to remember stable canon while still writing scenes naturally:

- who Mio is
- how she currently feels
- what she remembers
- how relationships are changing
- which facts are important enough to bring into future prompts

Without a model runtime, those facts tend to drift or disappear inside chat history. RP CLI gives the creator a place to make those facts explicit.

## Creator View

The creator owns `rp.module.ts`.

In this example, the creator maps story design into four model areas:

| Story design concept   | Model field     | Purpose                                                                    |
| ---------------------- | --------------- | -------------------------------------------------------------------------- |
| Character sheet        | `profile`       | Stable character canon such as name, age, and personality.                 |
| Current emotional beat | `mood`          | Scene-local emotional signals such as label, valence, arousal, and stress. |
| Social continuity      | `relationships` | Per-character relationship data and notes.                                 |
| Long-term continuity   | `memories`      | Durable facts the agent can recall later.                                  |

The creator also exposes semantic actions:

- `remember`: add a durable memory after the user establishes a meaningful fact.
- `setMood`: update emotional signals after a scene beat changes.

These actions are intentionally higher-level than raw JSON Patch. An agent can call `setMood` without knowing exactly how mood is stored.

The module also exposes views:

- `default`: a general overview of character, mood, relationship count, and pinned memories.
- `prompt`: compact prompt-facing context for the next generated scene.

That split is the key creative benefit: creators decide what belongs in canon, what operations are safe, and what context an agent should see.

## Agent / User View

The user or agent does not edit `rp.module.ts`. It uses the `rp` CLI.

Initialize a model file:

```bash
rp --module examples/life-sim/rp.module.ts --model mio.json init
```

Record a durable memory:

```bash
rp --module examples/life-sim/rp.module.ts --model mio.json \
  --reason "User established this preference." \
  action remember '{"text":"Mio likes rainy afternoons.","tags":["preference"],"pinned":true}'
```

Update the current mood:

```bash
rp --module examples/life-sim/rp.module.ts --model mio.json \
  --reason "Scene tone changed." \
  action setMood '{"label":"flustered but happy","valence":0.68,"arousal":0.4}'
```

Read prompt-ready context:

```bash
rp --module examples/life-sim/rp.module.ts --model mio.json view prompt
```

Read raw role model:

```bash
rp --module examples/life-sim/rp.module.ts --model mio.json model
```

Query pinned memories with `jq`:

```bash
rp --module examples/life-sim/rp.module.ts --model mio.json model \
  | jq '.memories[] | select(.pinned == true)'
```

## Discovery

Agents can discover what the module supports.

List actions:

```bash
rp --module examples/life-sim/rp.module.ts action --list
```

List views:

```bash
rp --module examples/life-sim/rp.module.ts view --list
```

Inspect the `setMood` input schema:

```bash
rp --module examples/life-sim/rp.module.ts action setMood --schema
```

Inspect the full model schema:

```bash
rp --module examples/life-sim/rp.module.ts model --schema
```

## Low-Level Update Escape Hatch

Creators can prefer semantic actions, while still allowing a low-level JSON Patch escape hatch when needed:

```bash
rp --module examples/life-sim/rp.module.ts --model mio.json \
  --reason "Scene moved to a quiet moment." \
  update '[{"op":"replace","path":"/mood/label","value":"calm"}]'
```

Patch paths are relative to the role model root, so `/mood/label` means `model.mood.label`.

## Validation, Migration, And Logs

Validate the current model:

```bash
rp --module examples/life-sim/rp.module.ts --model mio.json validate
```

Migrate an older model file:

```bash
rp --module examples/life-sim/rp.module.ts --model mio.json migrate
```

Read recent audit logs:

```bash
rp --module examples/life-sim/rp.module.ts --model mio.json log --limit 5
```

`--reason` is stored in the audit log, not in role model. This helps an agent or creator understand why a change happened without polluting the story model.

## Shorter Agent Commands

For an agent session, set paths once:

```bash
export RP_MODULE=examples/life-sim/rp.module.ts
export RP_MODEL=mio.json
```

Then the agent can use concise commands:

```bash
rp view prompt
rp action remember '{"text":"Mio likes rain.","pinned":true}'
rp action setMood '{"label":"calm","valence":0.3}'
rp log --limit 5
```

## Why This Helps Creativity

RP CLI does not write the story for you. It gives your story a durable, inspectable memory surface.

For creators, that means:

- character canon can be modeled explicitly
- scene-changing events can become named actions
- prompt context can be curated instead of copied manually
- schema changes can be migrated
- model changes can be audited with reasons

For agents, that means:

- less guessing about what matters
- fewer accidental schema-breaking writes
- better continuity across scenes
- a clear way to ask, "what can I do here?"
