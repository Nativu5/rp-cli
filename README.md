# RP CLI

[中文](./README.zh.md)

> Roleplaying CLI for AI agents based on Zod and Model-View-Update pattern.
>
> 🚧 Still under active development...

RP CLI is a small runtime for AI agents that need durable roleplay state. A creator describes a character or world with a Zod model and a few semantic operations; an agent then uses the `rp` command to read context, make intentional updates, and inspect why the model changed.

The design principle is MVU. The **Model** is the persisted `rp.model.json` file: profile, mood, relationships, memories, inventory, or any state the creator chooses. **Views** are read-only projections that turn model into prompt-ready context. **Updates** are either named actions or explicit JSON Patch operations; the runtime validates the next model before writing it back. This keeps creative rules in the module while giving agents a stable tool interface.

## Quick Start

```bash
# Install the CLI from npm
npm install -g @rp-cli/cli

# Open an example character
git clone https://github.com/Nativu5/rp-cli.git
cd rp-cli/examples/life-sim/mio

# Try it out
rp init
rp view prompt
rp \
  --reason "The scene shifted into a calmer beat." \
  action setMood '{"label":"calm","valence":0.45}'
```

Node.js `>=20.0.0` is required. Creators should prefer `.js` or `.mjs` modules for the widest compatibility. Local `.ts` and `.mts` modules are also supported when running on Node.js `>=24.0.0`.

By default, `rp` looks for `./rp.module.ts` and `./rp.module.js` next to `./rp.model.json`. You can also pass `--module` / `--model`, or set `RP_MODULE` / `RP_MODEL`.

## Repository Guide

- `packages/core`: creator-facing API (`defineModule`) and runtime internals.
- `packages/cli`: the `rp` command implementation.
- `examples/life-sim`: a example roleplay game setting.
- `skills/rp-cli-creator`: skill for agents to help creators to design the game.
- `skills/rp-cli-player`: skill for agents and human to play the game.

## Development Guide

```bash
# Install workspace dependencies
npm install

# Build both packages
npm run build

# Typecheck, test, lint, and format-check
npm run typecheck
npm test
npm run lint
npm run format:check
```

For local CLI development, use the workspace binary after installing dependencies:

```bash
cd examples/life-sim/mio
npx rp view prompt
```
