# RP CLI

[English](README.md)

Roleplaying CLI based on Zod and Model-View-Update pattern.

RP CLI 是一个面向 AI Agent 的角色扮演状态运行时。创作者用 Zod 描述角色或世界模型，并定义少量语义化操作；Agent 则通过 `rp` 命令读取上下文、写入有意义的变化、迁移旧状态，并查看模型为什么发生改变。

它的设计可以理解为用于叙事连续性的 MVU。**Model** 是持久化的 `rp.model.json`，可以保存角色档案、情绪、关系、记忆、物品或任意领域状态。**View** 是只读投影，把完整模型压缩成适合 prompt 的上下文。**Update** 是命名 action 或显式 JSON Patch；运行时会在写回前验证新模型。这样，创作规则留在 module 里，Agent 拿到的是稳定的工具接口。

这层分离是 RP CLI 的核心价值。聊天历史可以提供语境，但不适合作为可靠数据库。RP CLI 为角色扮演项目提供一个小而可检查的状态面：有 schema 校验、语义化写入、迁移、文件锁和 JSONL 审计日志。

## 本地体验

```bash
npm install
npm run build

rp --module examples/life-sim/src/rp.module.ts --model mio.json init
rp --module examples/life-sim/src/rp.module.ts --model mio.json view prompt
rp --module examples/life-sim/src/rp.module.ts --model mio.json \
  --reason "The scene shifted into a calmer beat." \
  action setMood '{"label":"calm","valence":0.45,"arousal":0.2}'
```

运行时需要 Node.js `>=24.0.0`。本地 module 支持 `.ts`、`.mts`、`.js`、`.mjs` 和 `.cjs`。

默认情况下，`rp` 会寻找 `./rp.module.ts` 和 `./rp.model.json`。也可以传入 `--module` / `--model`，或设置 `RP_MODULE` / `RP_MODEL`。

## 仓库导览

- `packages/core`：创作者 API（`defineModule`）和运行时内部能力。
- `packages/cli`：`rp` 命令实现。
- `examples/life-sim`：完整示例模块和使用流程。
- `skills/rp-cli-creator`：创作者设计 module 的说明。
- `skills/rp-cli-player`：Agent 在游玩中使用 RP CLI 的说明。
