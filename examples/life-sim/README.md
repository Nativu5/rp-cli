# Life Sim Example

This example shows how a creator can use RP CLI to turn character and story design into a reliable model tool for agents.

The module is intentionally small. It is not a complete game engine. It demonstrates the core pattern:

```
creator design -> Zod model schema -> semantic actions -> prompt views -> CLI usage by agents
```

## The Creative Idea

Imagine a slice-of-life roleplay centered on Mio. The agent needs stable model context while still writing scenes naturally:

- who Mio is
- how she currently feels
- what she is wearing
- how relationships are changing
- which state is important enough to bring into future prompts

Without a model runtime, those facts tend to drift or disappear inside chat history. RP CLI gives the creator a place to make those facts explicit.

## Design Philosophy

RP CLI leverages Linux's filesystem concept: **each directory represents a character**. When you operate inside a character's directory, the default module and model paths are enough.

```
examples/life-sim/
├── package.json          # ESM package boundary for Node.js
├── src/
│   └── rp.module.js     # Shared module source
├── mio/                  # Mio's directory
│   ├── rp.module.js@     # symlink -> ../src/rp.module.js
│   └── rp.model.json     # Mio's generated state
├── yuki/                 # Yuki's directory
│   ├── rp.module.js@     # symlink -> ../src/rp.module.js
│   └── rp.model.json     # Yuki's generated state
```

The local `package.json` declares `"type": "module"` so Node.js loads `rp.module.js` as ESM. JavaScript is the recommended authoring format for Node.js 20 compatibility. RP CLI's default discovery also checks `rp.module.ts` and prefers it when it exists and the current Node.js version can load TypeScript directly.

Templates and save archives are intentionally left to game packages or users; they can copy a character directory when they want that workflow.

## Creator View

The creator owns `src/rp.module.js`.

In this example, the creator maps story design into model areas:

| Story design concept   | Model field     | Purpose                                                                    |
| ---------------------- | --------------- | -------------------------------------------------------------------------- |
| Character sheet        | `profile`       | Stable character canon such as name, age, and personality.                 |
| Current emotional beat | `mood`          | Scene-local emotional signals such as label, valence, arousal, and stress. |
| Social continuity      | `relationships` | Per-character relationship data and notes.                                 |
| Numeric state          | `level`         | Simple numeric state for experience, power level, etc.                     |
| Clothing state         | `wear`          | Four-slot wardrobe: top, bottom, underwear, accessory.                     |

The creator exposes semantic actions:

- `setMood`: update emotional signals after a scene beat changes.
- `setLevel` / `levelUp`: manage numeric state.
- `setWear` / `removeWear`: manage clothing slots.

These actions are intentionally higher-level than raw JSON Patch. An agent can call `setMood` without knowing exactly how mood is stored.

The module also exposes views:

- `default`: a general overview of character, mood, relationship count, level, and wear.
- `prompt`: compact prompt-facing context for the next generated scene.

That split is the key creative benefit: creators decide what belongs in canon, what operations are safe, and what context an agent should see.

## Agent / User View

The user or agent does not edit `rp.module.js`. It uses the `rp` CLI.

Each character lives in its own directory. Operating from within a character's directory means the default paths can be used:

```bash
# Initialize Mio's model
cd examples/life-sim/mio
rp init

# Update Mio's mood
rp action setMood '{"label":"happy","valence":0.8}'

# Set level
rp action setLevel '{"level":5}'

# Level up
rp action levelUp

# Update clothing
rp action setWear '{"top":"blue blouse","bottom":"gray skirt","accessory":"silver hairpin"}'

# Remove an item
rp action removeWear '{"slot":"accessory"}'

# Read prompt context
rp view prompt

# Read raw model
rp model
```

## Discovery

Agents can discover what the module supports.

List actions:

```bash
rp action --list
```

List views:

```bash
rp view --list
```

Inspect the `setMood` input schema:

```bash
rp action setMood --schema
```

Inspect the full model schema:

```bash
rp model --schema
```

## Low-Level Update Escape Hatch

Creators can prefer semantic actions, while still allowing a low-level JSON Patch escape hatch when needed:

```bash
rp update '[{"op":"replace","path":"/mood/label","value":"calm"}]'
```

Patch paths are relative to the role model root, so `/mood/label` means `model.mood.label`.

## Validation, Migration, And Logs

Validate the current model:

```bash
rp validate
```

Migrate an older model file:

```bash
rp migrate
```

Read recent audit logs:

```bash
rp log --limit 5
```

`--reason` is stored in the audit log, not in role model. This helps an agent or creator understand why a change happened without polluting the story model.

## Working Across Characters

You can target a specific character's directory without changing your working directory:

```bash
# Option 1. Export environment variables in advance
export RP_MODULE=examples/life-sim/mio/rp.module.js
export RP_MODEL=examples/life-sim/mio/rp.model.json

# Option 2. Use flags on each command
rp --module examples/life-sim/mio/rp.module.js --model examples/life-sim/mio/rp.model.json \
  action setMood '{"label":"sleepy"}'
rp --module examples/life-sim/yuki/rp.module.js --model examples/life-sim/yuki/rp.model.json \
  action setMood '{"label":"energetic"}'
```

It's more natural to use separated directories for each character, but RP CLI is flexible enough to support a shared module and model if that fits your story design better.

## Why This Helps Creativity

RP CLI does not write the story for you. It gives your story a durable, inspectable memory surface.

For creators, that means:

- character canon can be modeled explicitly
- scene-changing events can become named actions
- numeric and complex state (like clothing) can be managed semantically
- prompt context can be curated instead of copied manually
- schema changes can be migrated
- model changes can be audited with reasons

For agents, that means:

- less guessing about what matters
- fewer accidental schema-breaking writes
- better continuity across scenes
- a clear way to ask, "what can I do here?"
