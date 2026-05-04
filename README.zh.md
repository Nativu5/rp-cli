# RP CLI

[English](./README.md)

> 面向 AI agents 的、基于 Zod 和 Model-View-Update 模式的命令行工具。
>
> 🚧 正在积极开发中...

RP CLI 是一个面向 AI Agent 的角色扮演状态运行时。创作者用 Zod 描述角色或世界模型，并定义少量语义化操作；Agent 则通过 `rp` 命令读取上下文、写入有意义的变化、迁移旧状态，并查看模型为什么发生改变。

设计核心原则为 MVU。**Model** 是持久化的 `rp.model.json`，可以保存角色档案、情绪、关系、记忆、物品或任意状态。**View** 是只读投影，把完整信息组合成适合 agent 的上下文。**Update** 是命名 action 或显式 JSON Patch；运行时会在写回前验证新模型。创作规则留在 module 里，Agent 拿到的是稳定的工具接口。

## 快速开始

```bash
# 安装 CLI
npm install
npm run build

# 打开一个示例角色
cd examples/life-sim/mio

# 试一试
npx rp init
npx rp view prompt
npx rp \
  --reason "The scene shifted into a calmer beat." \
  action setMood '{"label":"calm","valence":0.45}'
```

运行时需要 Node.js `>=24.0.0`。本地 module 支持 `.ts`、`.mts`、`.js`、`.mjs` 和 `.cjs`。

默认情况下，`rp` 会寻找 `./rp.module.ts` 和 `./rp.model.json`。也可以传入 `--module` / `--model`，或设置 `RP_MODULE` / `RP_MODEL`。

## 仓库导览

- `packages/core`：创作者 API（`defineModule`）和运行时内部能力。
- `packages/cli`：`rp` 命令实现。
- `examples/life-sim`：示例 RPG 设定和实现。
- `skills/rp-cli-creator`：面向创作者的 Agent 辅助设计 Skill。
- `skills/rp-cli-player`：面向 Agent 和人类的游戏玩家 Skill。
