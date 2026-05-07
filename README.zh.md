# RP CLI

[English](./README.md)

> 面向 AI agents 的、基于 Zod 和 Model-View-Update 模式的命令行工具。

RP CLI 是一个面向 AI Agent 的角色扮演状态运行时。创作者用 Zod 描述角色或世界模型，并定义少量语义化操作；Agent 则通过 `rp` 命令读取上下文、写入有意义的变化、迁移旧状态，并查看模型为什么发生改变。

## 设计原则

RP CLI 遵循 Model-View-Update。

- **Model** 是持久化的 `rp.model.json`，可以保存角色档案、情绪、关系、记忆、物品或创作者定义的任意状态。
- **View** 通常把模型组合成适合 Agent 的上下文。创作者也可以有意在 View 中修改模型来表达查询副作用，例如记录某段上下文已经被读取。
- **Update** 是常规写入路径。命名 action 会直接修改经过验证的模型副本，`rp update` 则保留为底层 JSON Patch 逃生口。

RP CLI 将创作者定义的“游戏规则”留在 module 的内部，并向外提供稳定的工具接口。

## 快速开始

```bash
# 从 npm 安装全局 CLI
npm install -g @rp-cli/cli

# 打开一个示例角色
git clone https://github.com/Nativu5/rp-cli.git
cd rp-cli/examples/life-sim
npm install
cd mio

# 试一试
rp init
rp view MioBackground
rp \
  --reason "The scene shifted into a calmer beat." \
  action setMood '{"label":"calm","valence":0.45}'
```

运行时需要 Node.js `>=20.0.0`。推荐创作者优先使用 `.js` 或 `.mjs` module，以获得更好的兼容性。本地 `.ts` 和 `.mts` module 也支持，但直接加载需要 Node.js `>=24.0.0`。

默认情况下，`rp` 会在 `./rp.model.json` 旁寻找 `./rp.module.ts` 和 `./rp.module.js`。也可以传入 `--module` / `--model`，或设置 `RP_MODULE` / `RP_MODEL`。

Action 和 view 命令默认只打印创作者设置的 `result`。如果需要稳定 JSON envelope，例如 `{ "result": ... }`，可以使用 `--output json`。

## 仓库导览

- `packages/core`：创作者 API（`defineModule`）和运行时内部能力。
- `packages/cli`：`rp` 命令实现。
- `examples/life-sim`：示例 RPG 设定和实现。
- `skills/rp-cli-creator`：面向创作者的 Agent 辅助设计 Skill。
- `skills/rp-cli-player`：面向 Agent 和人类的游戏玩家 Skill。

## 开发指南

```bash
# 安装 workspace 依赖
npm install

# 构建两个 package
npm run build

# 类型检查、测试、lint 和格式检查
npm run typecheck
npm test
npm run lint
npm run format:check
```

本仓库使用 npm workspaces：

- `@rp-cli/core`：把创作者 API 和运行时内部能力构建到 `packages/core/dist`。
- `@rp-cli/cli`：把全局 `rp` 命令构建到 `packages/cli/dist`。
- `tsconfig.examples.json`：使用 `allowJs` 检查 JavaScript 示例。

本地开发 CLI 时，安装依赖后可以使用 workspace binary：

```bash
cd examples/life-sim/mio
npx rp view MioBackground
```

发布前建议检查打包内容：

```bash
npm pack -w @rp-cli/core --dry-run
npm pack -w @rp-cli/cli --dry-run
```
