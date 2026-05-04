# RP-CLI: 面向 AI Agent 的角色扮演 CLI 框架

**RP CLI 是一个基于 Zod 的命令行模型运行时框架。**

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
│   │       ├── runtime.ts
│   │       ├── modelFile.ts
│   │       ├── modelLock.ts
│   │       ├── modelAccess.ts
│   │       ├── view.ts
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
│               ├── model.ts
│               ├── update.ts
│               ├── view.ts
│               └── validate.ts
└── tests/
    ├── architecture-contract.test.ts
    ├── core-runtime-units.test.ts
    ├── creator-experience.test.ts
    ├── discovery-read-apis.test.ts
    ├── life-sim-example.test.ts
    ├── logging.test.ts
    ├── migration.test.ts
    ├── runtime-foundations.test.ts
    ├── state-lifecycle.test.ts
    └── write-commands.test.ts
```

## 模块说明

### `@rp-cli/core`

外部创作者依赖的 public API。创作者模块应只从这里导入，例如：

```ts
import { defineModule } from "@rp-cli/core";
```

当前 public API 只暴露：

- `defineModule`
- 创作者需要的类型，如 `RpModule`、`RpAction`、`RpView`、`RpMigration`、`JsonPatch`、`RpMeta`

不要从 public API 暴露 loader、model file、validation、lock、log 等 runtime-only 工具。

### `@rp-cli/core/internal`

CLI runtime 内部 API。`packages/cli` 应只从这里导入 runtime operation、错误类型、路径解析和必要类型，例如：

```ts
import { runActionOperation, readModelOperation } from "@rp-cli/core/internal";
```

核心运行时包，负责：

- `defineModule.ts`: 创作者 public builder，保持 typed authoring 体验。
- `moduleParser.ts`: 内部 parser/validator，接收 `unknown`，返回校验后的 `RpModule`。
- `moduleLoader.ts`: 加载本地 TypeScript `rp.module.ts`，并通过 `parseModule` 校验默认导出。
- `types.ts`: 定义 `RpModule`、`RpModelFile`、`RpMeta`、`RpAction`、`RpView`、`RpMigration`、`JsonPatch` 等公共类型。
- `errors.ts`: 定义 `RpError`、错误码和统一错误 JSON 输出结构。
- `validation.ts`: 校验 model envelope，并检查 `rp.schemaVersion` 与 `module.model.version`。
- `modelFile.ts`: 解析 module/model/log/lock 文件路径，读取 model file，创建 envelope，提供原子 JSON 写入。
- `modelLock.ts`: 基于 `proper-lockfile` 提供 model write lock，支持 stale lock 恢复和短暂重试。
- `modelAccess.ts`: 为 action/view handler 提供 deep-frozen model clone。
- `patch.ts`: 使用 `fast-json-patch` 校验 JSON Patch。
- `action.ts`: 查找 action 并校验 action 返回值基础结构。
- `view.ts`: 按 default/brief/第一个 view 的规则查找 view。
- `migration.ts`: 校验迁移前置条件。
- `runtime.ts`: 组合 CLI runtime operations，统一编排 module loading、model 读写、lock、validation、action/update/migration/view 执行、JSON Schema 查询和 audit log。
- `log.ts`: 提供 model hash 工具。
- `index.ts`: 统一导出 public creator API。
- `internal.ts`: 显式导出 CLI 可用的 runtime operation surface；不要重新变回全量 barrel export。

### `@rp-cli/cli`

命令行包，负责：

- `cli.ts`: 创建 Commander program，注册全局参数和命令。
- `commandRunner.ts`: 解析全局 CLI 参数，统一命令错误处理和 exit code 映射。
- `output.ts`: 输出 JSON 和错误 JSON。
- `commands/init.ts`: `rp init`，从 module defaults 初始化 model file，支持 `--force`。
- `commands/validate.ts`: `rp validate`，验证 envelope、schemaVersion 和 author model。
- `commands/migrate.ts`: `rp migrate`，执行 schemaVersion 迁移，拒绝跨 module 迁移，支持 `--dry-run` 和日志记录。
- `commands/model.ts`: `rp model`，输出 author model，支持 `--raw` 和 `--schema`。
- `commands/update.ts`: `rp update`，应用标准 JSON Patch，验证 patch 后 model，支持 `--file`。
- `commands/action.ts`: `rp action [name] [input]`，包含 `--list`、`--schema` 和 `--file`。
- `commands/view.ts`: `rp view [name]`，包含 `--list`。
- `commands/log.ts`: `rp log`，读取 JSONL 审计日志，支持 `--limit`。

不提供独立 `rp actions` 或 `rp schema` 命令；能力发现使用 `rp action --list` 和 `rp view --list`，schema 查询使用 `rp model --schema` 和 `rp action <name> --schema`。

### `examples/life-sim`

示例创作者模块，当前包含：

- Zod model schema。
- `model.version`。
- `model.defaults`。
- `model.migrate`。
- `remember` action。
- `setMood` action。
- `default` 和 `prompt` view。

### `tests`

测试入口：

- `architecture-contract.test.ts`: 验证 creator public API、CLI runtime internal API 和 CLI command import 边界。
- `creator-experience.test.ts`: 从创作者视角验证只依赖 public API 编写模块，并通过 CLI 完成 init/action/schema/view/validate 流程。
- `runtime-foundations.test.ts`: 验证 core runtime foundation、module loading、envelope 校验和 runtime schema 查询。
- `state-lifecycle.test.ts`: 验证 `init`、`validate`、`model`、原子写入和 lock 行为。
- `write-commands.test.ts`: 验证 `update`、`action`、dry-run、input/return 校验和 model mutation 防护。
- `migration.test.ts`: 验证 migration、schemaVersion 行为和跨 module 拒绝。
- `discovery-read-apis.test.ts`: 验证 `view`、object-local schema 和 read API。
- `logging.test.ts`: 验证 JSONL audit log。
- `life-sim-example.test.ts`: 验证示例模块端到端流程。

## 开发规则

- 避免过度设计，保持核心功能的专注和简洁，模块封装自然清晰。
- 代码风格统一，注释清晰，易于维护和扩展。
- 所有注释使用英文。文档推荐使用中文。
- 当前项目是从头开发的新项目，正确性 > 兼容性，为了架构的正确和优雅可以不考虑对旧代码的兼容性。
