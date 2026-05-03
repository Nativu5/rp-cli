# RP-CLI: 面向 AI Agent 的角色扮演 CLI 框架

**RP CLI 是一个基于 Zod 的命令行状态运行时框架。**

## 技术栈

Node.js + TypeScript + Zod + Commander + fast-json-patch

## 当前目录结构

```text
.
├── AGENTS.md
├── README.md
├── package.json
├── package-lock.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── vitest.config.ts
├── docs/
│   ├── NEED.md        需求分析
│   ├── PLAN.md        设计方案
│   └── PROGRESS.md    实现进度
├── examples/
│   └── life-sim/
│       ├── rp.module.ts
│       └── README.md
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── action.ts
│   │       ├── defineModule.ts
│   │       ├── errors.ts
│   │       ├── index.ts
│   │       ├── internal.ts
│   │       ├── log.ts
│   │       ├── migration.ts
│   │       ├── moduleLoader.ts
│   │       ├── moduleParser.ts
│   │       ├── patch.ts
│   │       ├── schema.ts
│   │       ├── stateFile.ts
│   │       ├── summary.ts
│   │       ├── types.ts
│   │       └── validation.ts
│   └── cli/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── commandRunner.ts
│           ├── cli.ts
│           ├── output.ts
│           └── commands/
│               ├── action.ts
│               ├── init.ts
│               ├── log.ts
│               ├── migrate.ts
│               ├── patch.ts
│               ├── schema.ts
│               ├── state.ts
│               ├── summary.ts
│               └── validate.ts
└── tests/
    ├── state-lifecycle.test.ts
    ├── scaffold.test.ts
    └── runtime-foundations.test.ts
```

## 模块说明

### `@rp-cli/core`

外部创作者依赖的 public API。创作者模块应只从这里导入，例如：

```ts
import { defineModule } from "@rp-cli/core";
```

当前 public API 只暴露：

- `defineModule`
- 创作者需要的类型，如 `RpModule`、`RpAction`、`RpSummary`、`RpMigration`、`JsonPatch`、`RpMeta`

不要从 public API 暴露 loader、state file、validation、lock、log 等 runtime-only 工具。

### `@rp-cli/core/internal`

CLI 和 runtime 内部 API。`packages/cli` 应从这里导入内部能力，例如：

```ts
import { loadModule, readStateFile } from "@rp-cli/core/internal";
```

核心运行时包，负责：

- `defineModule.ts`: 创作者 public builder，保持 typed authoring 体验。
- `moduleParser.ts`: 内部 parser/validator，接收 `unknown`，返回校验后的 `RpModule`。
- `moduleLoader.ts`: 加载本地 TypeScript `rp.module.ts`，并通过 `parseModule` 校验默认导出。
- `types.ts`: 定义 `RpModule`、`RpStateFile`、`RpMeta`、`RpAction`、`RpSummary`、`RpMigration`、`JsonPatch` 等公共类型。
- `errors.ts`: 定义 `RpError`、错误码和统一错误 JSON 输出结构。
- `validation.ts`: 校验 state envelope，并检查 `rp.schemaVersion` 与 `module.state.version`。
- `stateFile.ts`: 解析 module/state/log/lock 文件路径，读取 state file，创建 envelope，提供原子 JSON 写入和基础 lock 文件机制。
- `patch.ts`: 使用 `fast-json-patch` 校验 JSON Patch。
- `action.ts`: 查找 action 并校验 action 返回值基础结构。
- `summary.ts`: 按 default/brief/第一个 summary 的规则查找 summary。
- `migration.ts`: 校验迁移前置条件。
- `schema.ts`: 导出 Zod schema 对应的 JSON Schema。
- `log.ts`: 提供 state hash 工具。
- `index.ts`: 统一导出 public creator API。
- `internal.ts`: 统一导出 runtime internal API。

### `@rp-cli/cli`

命令行包，负责：

- `cli.ts`: 创建 Commander program，注册全局参数和命令。
- `commandRunner.ts`: 解析全局 CLI 参数，统一命令错误处理和 exit code 映射。
- `output.ts`: 输出 JSON 和错误 JSON。
- `commands/init.ts`: `rp init`，从 module defaults 初始化 state file，支持 `--force`。
- `commands/validate.ts`: `rp validate`，验证 envelope、schemaVersion 和 author state。
- `commands/migrate.ts`: `rp migrate` 命令骨架。
- `commands/state.ts`: `rp state`，输出 author state，支持 `--raw` 输出完整 envelope。
- `commands/patch.ts`: `rp patch` 命令骨架。
- `commands/action.ts`: `rp action [name] [input]`，包含 `--list` 和 `--file`。
- `commands/summary.ts`: `rp summary [name]`，包含 `--list`。
- `commands/schema.ts`: `rp schema [target] [name]` 命令骨架。
- `commands/log.ts`: `rp log` 命令骨架。

不提供独立 `rp actions` 命令；能力发现使用 `rp action --list` 和 `rp summary --list`，单个 action input schema 使用 `rp schema action <name>`。

### `examples/life-sim`

示例创作者模块，当前包含：

- Zod state schema。
- `state.version`。
- `state.defaults`。
- `state.migrate`。
- `remember` action。
- `default` summary。

### `tests`

测试入口：

- `scaffold.test.ts`: 验证 workspace/CLI 命令骨架。
- `runtime-foundations.test.ts`: 验证 Phase 2 的 core runtime foundation。
- `state-lifecycle.test.ts`: 验证 Phase 3 的 `init`、`validate`、`state`、原子写入和 lock 行为。

## 当前实现进度

- Phase 1 Basic Scaffolding 已完成。
- Phase 2 Core Runtime Foundations 已完成。
- Phase 3 State Lifecycle Commands 已完成。
- 当前下一阶段是 Phase 4：实现 `rp patch`、`rp action`、JSON Patch 应用、action input/return 校验和 action CLI 输出。

## 开发规则

- 避免过度设计，保持核心功能的专注和简洁，模块封装自然清晰。
- 代码风格统一，注释清晰，易于维护和扩展。
- 所有注释使用英文。文档推荐使用中文。
- 当前项目是从头开发的新项目，正确性 > 兼容性，为了架构的正确和优雅可以不考虑对旧代码的兼容性。
