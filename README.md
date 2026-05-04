# RP CLI

[中文](README.zh.md)

Roleplaying CLI based on Zod and Model-View-Update pattern.

RP CLI is a small runtime for AI agents that need durable roleplay state. A creator describes a character or world with a Zod model and a few semantic operations; an agent then uses the `rp` command to read context, make intentional updates, migrate old state, and inspect why the model changed.

The design is MVU applied to story continuity. The **Model** is the persisted `rp.model.json` file: profile, mood, relationships, memories, inventory, or any domain state the creator chooses. **Views** are read-only projections that turn that full model into prompt-ready context. **Updates** are either named actions or explicit JSON Patch operations; the runtime validates the next model before writing it back. This keeps creative rules in the module while giving agents a stable tool interface.

That separation is the point. Chat history is useful context, but it is not a reliable database. RP CLI gives roleplay projects a small, inspectable state surface with schema validation, semantic writes, migrations, file locking, and JSONL audit logs.

## Try It Locally

```bash
npm install
npm run build

rp --module examples/life-sim/src/rp.module.ts --model mio.json init
rp --module examples/life-sim/src/rp.module.ts --model mio.json view prompt
rp --module examples/life-sim/src/rp.module.ts --model mio.json \
  --reason "The scene shifted into a calmer beat." \
  action setMood '{"label":"calm","valence":0.45,"arousal":0.2}'
```

Node.js `>=24.0.0` is required. Local modules may be `.ts`, `.mts`, `.js`, `.mjs`, or `.cjs`.

By default, `rp` looks for `./rp.module.ts` and `./rp.model.json`. You can also pass `--module` / `--model`, or set `RP_MODULE` / `RP_MODEL`.

## Repository Guide

- `packages/core`: creator-facing API (`defineModule`) and runtime internals.
- `packages/cli`: the `rp` command implementation.
- `examples/life-sim`: a complete module and workflow.
- `skills/rp-cli-creator`: guidance for designing modules.
- `skills/rp-cli-player`: guidance for agents using RP CLI during play.
