# RP CLI

[中文](./README.zh.md)

> Roleplaying CLI for AI agents based on Zod and Model-View-Update pattern.

RP CLI is a small runtime for AI agents that need durable roleplay state. A creator describes a character or world with a Zod model and a few semantic operations; an agent then uses the `rp` command to read context, make intentional updates, and inspect why the model changed.

## Design Principles

RP CLI follows Model-View-Update.

- **Model** is the persisted `rp.model.json` file and can store character profiles, emotions, relationships, memories, items, or any other creator-defined state.
- **View** usually combines the model into agent-friendly context. A creator can also intentionally mutate the model inside a View to express query side effects, such as recording that a piece of context has already been read.
- **Update** is the normal write path. Named actions mutate a validated model clone directly, while `rp update` remains as a low-level JSON Patch escape hatch.

RP CLI keeps the creator-defined game rules inside the module and exposes a stable tool interface to the outside.

## Quick Start

```bash
# Install the CLI from npm
npm install -g @rp-cli/cli

# Open an example character
git clone https://github.com/Nativu5/rp-cli.git
cd rp-cli/examples/life-sim/mio

# Try it out
rp init
rp view MioBackground
rp \
  --reason "The scene shifted into a calmer beat." \
  action setMood '{"label":"calm","valence":0.45}'
```

Node.js `>=20.0.0` is required. Creators should prefer `.js` or `.mjs` modules for the widest compatibility. Local `.ts` and `.mts` modules are also supported when running on Node.js `>=24.0.0`.

By default, `rp` looks for `./rp.module.ts` and `./rp.module.js` next to `./rp.model.json`. You can also pass `--module` / `--model`, or set `RP_MODULE` / `RP_MODEL`.

Action and view commands print only the creator-defined `result` by default. Use `--output json` when you need a stable JSON envelope such as `{ "result": ... }`.

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
npx rp view MioBackground
```
