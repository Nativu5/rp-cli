# RP CLI Enhancement Report

本文从架构合理度、功能完成度、用户易用度三个角度分析当前仓库实现，并按优先级从高到低列出优化建议。

## 总体判断

当前实现已经不只是 scaffold：`init`、`validate`、`model`、`update`、`action`、`view`、`migrate`、`log` 的 MVP 主流程均已实现，并有较完整的 Vitest 覆盖。整体架构遵循了设计文档中的 public creator API 与 runtime internal API 分层，核心运行时也保持了较低耦合。

下一阶段的重点不应是继续扩命令数量，而应是 release-readiness hardening：明确运行时加载契约、补强模块/模型边界、约束 action/view 的运行时副作用、提升写入审计可靠性，并降低 Agent 每次调用的配置和输入成本。

## Model/View/Action/Update 设计判断

从更本质的架构语言看，RP CLI 可以被解释为一个面向 CLI 和 AI Agent 的 Model/View/Action/Update 运行时：

| 概念   | RP CLI 实现 | 说明                                                           |
| ------ | ----------- | -------------------------------------------------------------- |
| Model  | `model`     | 创作者定义的持久世界模型。                                     |
| View   | `view`      | 从 model 派生出的只读展示、prompt context、debug view 或投影。 |
| Action | `action`    | 创作者定义的具名动作，可包含业务语义并返回 JSON Patch。        |
| Update | `update`    | 底层 JSON Patch 写入口，面向逃生口和自动化写入。               |

这个判断说明 `action/view/update` 的组合并不怪：它是在表达只读投影、创作者动作和底层更新协议的分层。`action` 应保留为创作者定义的具名动作；`update` 则承担 raw JSON Patch 写入。

因此，顶层心智模型应调整为 **Model / View / Action / Update**：

- 文档中把 `model` 明确称为 creator-defined model。
- 把 `view` 解释为 read-only view，而不只是 prompt 摘要。
- 把 `action` 解释为 creator-defined named action，返回 JSON Patch，由 runtime 应用、校验、落盘和记录日志。
- `update` 是底层 JSON Patch 写入口 / escape hatch，不是与 action 并列的业务抽象。
- 当前尚未发布，因此旧 alias 已直接移除。

## 评分概览

| 维度       | 当前判断                        | 主要理由                                                                                                                                  |
| ---------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 架构合理度 | 良好，但运行时边界仍需硬化      | `@rp-cli/core` 与 `@rp-cli/core/internal` 分层清晰，model写入流程集中；但模块身份、model 只读契约、TypeScript loader 契约尚未形成强约束。 |
| 功能完成度 | MVP 基本完成                    | 设计中的主命令和测试覆盖已落地；剩余问题主要是生产可靠性、边界行为和发布形态。                                                            |
| 用户易用度 | 可用，但 Agent 长期使用仍偏繁琐 | JSON 输出和默认路径有利于脚本化；但缺少项目配置、stdin、能力总览、发布安装说明和更一致的命令结果结构。                                    |

## 优先级总表

| 优先级 | 状态     | 角度       | 优化项                                          | 影响                                                            |
| ------ | -------- | ---------- | ----------------------------------------------- | --------------------------------------------------------------- |
| P0     | 已修复   | 架构合理度 | 明确并实现 TypeScript module loading 的发布契约 | 决定 `rp.module.ts` 在真实安装环境中是否稳定可用。              |
| P0     | 已修复   | 架构合理度 | 校验 model envelope 与当前 module 的身份兼容性  | 防止错误模块读取或写入兼容但不属于自己的 model。                |
| P0     | 已修复   | 架构合理度 | 强制 action/view 不能通过对象引用修改 model     | 维护“所有写入必须经 JSON Patch”的核心架构承诺。                 |
| P1     | 部分修复 | 功能完成度 | 强化 model lock 与日志一致性                    | 减少 Agent 高频调用时的卡死、审计缺口和误判失败。               |
| P1     | 待处理   | 用户易用度 | 增加项目级配置和向上查找                        | 降低每次调用都传 `--module`、`--model` 的成本。                 |
| P1     | 待处理   | 功能完成度 | 增加 dist/bin 形态的端到端测试和 CI             | 当前测试主要跑源码入口，发布风险没有被系统验证。                |
| P1     | 待处理   | 用户易用度 | 改进 CLI 输入输出契约                           | 支持 stdin、无输入 action、更一致的输出 envelope。              |
| P2     | 待处理   | 功能完成度 | 改进 migration 模型                             | 当前单函数迁移可用，但复杂 schema 演进缺少版本链和可审计 diff。 |
| P2     | 待处理   | 用户易用度 | 增强 capability discovery                       | 让 Agent 一次获取 actions、views、schemas 和路径信息。          |
| P2     | 待处理   | 架构合理度 | 改进审计 hash 与日志查询能力                    | 提升日志的可比对性、过滤能力和长期可维护性。                    |
| P3     | 待处理   | 用户易用度 | 同步文档、AGENTS.md 和发布说明                  | 减少“实现已完成但文档仍说骨架/下一阶段”的认知偏差。             |
| P3     | 待处理   | 架构合理度 | 小型工程化整理                                  | 错误码细分、包发布字段、Node engines、边界命名校验等。          |

## P0-1: 明确并实现 TypeScript Module Loading 的发布契约

**修复model：已修复。** 当前实现声明 Node runtime 为 `>=24.0.0`，并在
`loadModule()` 导入前校验 module 文件扩展名，仅支持 `.ts`、`.mts`、`.js`、`.mjs`、`.cjs`。不支持的扩展会返回
`MODULE_INVALID`，并在 details 中输出支持列表。仍建议后续 P1 增加 dist/bin 形态的端到端测试。

### 现状

`packages/core/src/moduleLoader.ts` 使用 `import(pathToFileURL(modulePath).href)` 直接加载 `rp.module.ts`。在当前仓库的 Vitest/源码环境中，这条路径可用；构建后 CLI 在本机 Node `v24.14.0` 下也能加载 `examples/life-sim/rp.module.ts`。但仓库没有声明支持的 Node 版本、没有 runtime loader 抽象，也没有把 `tsx` 或 `jiti` 作为明确的运行时策略。

另外，创作者模块通常会写：

```ts
import { defineModule } from "@rp-cli/core";
```

如果用户只全局安装 `rp`，但项目本地没有安装 `@rp-cli/core`，模块解析可能失败。这个依赖关系需要在安装模型中明确。

### 风险

- 发布后在不同 Node 版本、不同包管理器、全局安装和本地安装方式下行为不一致。
- 测试通过并不等于 npm package/bin 形态可用。
- 用户遇到的错误会表现为 `MODULE_INVALID`，但真实原因可能是 loader 或依赖解析问题。

### 建议

1. 明确支持矩阵：例如支持 `rp.module.ts`、`rp.module.mts`、`rp.module.js` 的哪些组合，以及最低 Node 版本。
2. 抽象 `loadModule()` 的加载策略：
   - 方案 A：内置 `tsx`/`jiti` loader，稳定支持 TypeScript。
   - 方案 B：要求创作者编译成 JS，`rp.module.ts` 只作为开发期格式。
   - 方案 C：检测 Node 原生 TypeScript 支持，不满足时给出明确错误和安装建议。
3. 在 `package.json` 中增加 `engines.node`，并补充 built CLI 测试。
4. 文档中明确推荐安装方式：项目本地安装 `@rp-cli/core` 与 `@rp-cli/cli`，或说明全局 CLI 如何解析创作者模块依赖。

## P0-2: 校验 Model Envelope 与当前 Module 的身份兼容性

**修复model：已修复。** 当前实现新增 `MODULE_MODEL_MISMATCH` 和
`assertModuleCompatibility()`。所有通过 `validateModelFile()` 的读写命令都会检查
`rp.module === module.name`；`rp migrate` 也会拒绝跨 module 迁移。同名 module 的 `moduleVersion` 仍允许不同，版本演进继续由
`schemaVersion` 和 migration 负责。

### 现状

`validateModelFile()` 当前会检查：

- model envelope 结构。
- `rp.schemaVersion` 与 `module.model.version`。
- author model 是否通过 Zod schema。

但它没有检查 `envelope.rp.module` 是否等于 `module.name`，也没有明确 `moduleVersion` 不一致时应如何处理。写入时 `updateModelEnvelope()` 会把 envelope 的 module/moduleVersion 覆盖为当前 module，这可能掩盖错误模块操作了旧 model 的问题。

### 风险

- 两个模块 schema 恰好兼容时，错误 module 可以 validate/action/update 另一个模块的 model。
- metadata 被静默改写，审计上难以追溯 model 原本属于哪个模块。
- 对 AI Agent 来说，路径配错是高概率事件；该问题会直接影响数据正确性。

### 建议

1. 增加 `assertModuleCompatibility(meta, module)`：
   - `meta.module !== module.name` 时默认返回新的错误码，例如 `MODULE_MODEL_MISMATCH`。
   - `moduleVersion` 策略需要明确：严格相等、允许同名不同版本，或仅 warning/log。
2. 所有非 `migrate` 命令都先检查 module identity，再检查 schema version。
3. `migrate` 可以允许同名 module 的旧 moduleVersion，但不应允许跨 module 迁移，除非显式增加 `--adopt` 或类似危险选项。
4. 增加路径配错的集成测试。

## P0-3: 强制 Action/View 不能通过对象引用修改 Model

**修复model：已修复。** 当前实现会在调用 action/view 前向创作者代码传入 deep clone 后的 deep frozen model。直接修改
model 会触发 runtime error：action 映射为 `ACTION_RUNTIME_ERROR`，view 映射为 `VIEW_RUNTIME_ERROR`，并且不会落盘。

### 现状

类型层面传给 action/view 的 model 是 `Readonly<TModel>`，但这是浅层 TypeScript 约束，运行时没有保护。当前 `runAction()` 和 `runView()` 会向创作者代码传入 deep-frozen clone。

如果没有运行时保护，action 可以在返回 patch 前直接 mutate `model` 对象。随后 `applyJsonPatch(envelope.model, result.patch)` 会基于已经被 mutate 的对象计算 next model，破坏“action 只返回 patch，框架统一写入”的核心模型。view 也可能在读取时修改内存对象，虽然未必落盘，但会让一次命令内的行为变得不可预测。

### 风险

- JSON Patch 不再是唯一写入协议，审计日志无法完整表达真实变更。
- `modelHashBefore` 可能基于已经被 action 改过的对象计算，审计价值下降。
- 创作者模块 bug 会绕过框架校验边界。

### 建议

1. 在调用 action/view 前对 model 做 deep clone 或 deep freeze。
2. `modelHashBefore` 应在调用创作者代码前计算。
3. 对 action 建议使用 deep freeze；如需兼容性能，可提供内部 `cloneForUserCode()` 并在文档说明。
4. 增加测试：恶意 action 直接修改 model 但返回空 patch，最终不得落盘；返回非空 patch 时也不得携带直接 mutation。

## P1-1: 强化 Model Lock 与日志一致性

**修复model：部分修复，锁机制已修复。** 当前实现已引入
`proper-lockfile`，用原子 `mkdir` 锁目录替代手写
`open(lockPath, "wx")`。写命令现在支持短暂等待活跃锁释放，并能基于
mtime 恢复 stale lock。锁实现已从 `modelFile.ts` 拆分到
`modelLock.ts`，命令层统一调用 `withModelLock(paths, ...)`。日志一致性修复路径仍保留为后续 P1 工作。

### 现状

当前 lock 使用 `proper-lockfile`。它采用原子 `mkdir` 策略，并通过定期更新 lock 目录 mtime 检测 stale lock。日志写入失败时不回滚 model，这是设计文档允许的 MVP 策略，并已有测试覆盖。
不建议优先切换到 `fcntl`：Node 没有稳定内建的跨平台 `fcntl` advisory lock API，引入它通常意味着 native addon 和 Unix-only 语义；当前技术栈更适合使用成熟的 lockfile 库。

但当前缺少：

- lock 所属进程/时间的用户可读诊断。
- 写 model 成功但 log 失败后的修复机制。
- read 命令与 write 命令之间的一致性策略说明。

### 风险

- 审计日志缺口需要人工发现和修复。

### 建议

1. lock 文件记录 `pid`、`hostname`、`createdAt`、`command`。
2. 将当前固定的 lock stale/retry 参数暴露为 CLI 或配置项。
3. 对 log failure 增加修复路径：
   - 在 model meta 中记录 `lastLogStatus` 或 `lastOperationId`。
   - 提供 `rp log verify` / `rp doctor` 检查 model 与 log 是否一致。
4. 使用稳定 stringify 生成 model hash，避免对象 key 顺序影响审计 hash。

## P1-2: 增加项目级配置和向上查找

### 现状

当前路径优先级为 CLI 参数、环境变量、默认路径。README 已明确列出尚未支持 `rp.config.json`、`rp.config.ts`、自动向上查找、package.json 配置等。

### 风险

- Agent 在不同工作目录调用时容易遗漏或传错 `--module`、`--model`。
- 多角色、多存档、多 profile 场景需要靠 shell 变量管理，扩展性有限。
- 新用户上手命令偏长。

### 建议

1. 增加 `rp.config.json`：

```json
{
  "module": "./rp.module.ts",
  "model": "./rp.model.json"
}
```

2. 从当前目录向上查找配置文件，找到项目根。
3. 保持优先级：CLI 参数 > 环境变量 > 配置文件 > 默认路径。
4. 后续再加 profiles：

```json
{
  "profiles": {
    "mio": { "model": "./models/mio.json" },
    "haru": { "model": "./models/haru.json" }
  }
}
```

## P1-3: 增加 Dist/Bin 形态的端到端测试和 CI

### 现状

测试覆盖比较充分，但多数测试直接 import `packages/cli/src/cli.ts`，并通过 Vitest alias 指向源码。它能验证业务逻辑，却不能完全验证：

- `npm run build` 后的 dist 文件。
- package `exports`。
- bin `rp`。
- 外部项目中的 `@rp-cli/core` 解析。
- 不同 Node 版本下的 TypeScript module loading。

### 风险

- 源码测试全部通过，但发布包不可用。
- CLI 的真实安装路径和测试路径不一致。

### 建议

1. 增加一个 `tests/package-smoke.test.ts` 或 shell smoke：
   - 运行 `npm run build`。
   - 在临时目录创建 `package.json` 和 `rp.module.ts`。
   - 通过 `node packages/cli/dist/cli.js` 或 npm link 后的 `rp` 执行完整流程。
2. 增加 GitHub Actions：
   - `npm ci`
   - `npm run typecheck`
   - `npm test`
   - `npm run lint`
   - `npm run build`
3. 如支持多个 Node 版本，CI 使用 matrix。

## P1-4: 改进 CLI 输入输出契约

### 现状

CLI 输出均为 JSON，适合 Agent 使用。但输出 shape 不一致：

- `init` 输出完整 envelope。
- `patch` 输出 `{ patch, model }`。
- `action` 输出 `{ result: { patch, model }, message }` 或 `{ result: null }`。
- `migrate` 输出 `{ fromVersion, toVersion, model }`。
- error JSON 写到 stdout。

输入方面，`patch` 和 `action` 支持 inline JSON 和 `--file`，但不支持 stdin。无输入 action 也必须显式传 `{}`。

### 风险

- Agent 需要为每个命令写不同解析逻辑。
- shell 管道和大 JSON 输入不方便。
- stdout 同时承载正常结果和错误结果，可能干扰管道语义。

### 建议

1. 增加统一结果 envelope：

```json
{
  "ok": true,
  "command": "action",
  "dryRun": false,
  "written": true,
  "logWritten": true,
  "data": {}
}
```

2. 保持当前输出作为默认也可以，但可增加 `--output envelope` 或在 1.0 前统一。
3. 支持 stdin：

```bash
cat patch.json | rp update -
cat input.json | rp action remember -
```

4. 对 `z.object({})` 或 `z.void()` 类 action 支持省略 input。
5. 考虑将错误 JSON 输出到 stderr，同时保留机器可读格式；如保持 stdout，也应在文档中明确。

## P2-1: 改进 Migration 模型

### 现状

当前 `model.migrate` 是一个函数，接收 `fromVersion` 和 `toVersion`，由创作者自行处理任意旧版本到当前版本的迁移。MVP 足够简洁。

### 风险

- 多版本长期演进时，单函数容易膨胀。
- 很难测试每一段迁移。
- 无法复用每个版本的中间 schema 校验。

### 建议

1. 保留现有 `migrate`，但新增可选的 versioned migrations：

```ts
migrations: {
  1: migrateFrom1To2,
  2: migrateFrom2To3
}
```

2. `rp migrate --dry-run` 输出 patch/diff 或 hash before/after。
3. 增加 `rp model --schema --version <n>` 的设计空间，便于调试旧model。

## P2-2: 增强 Capability Discovery

### 现状

已有：

- `rp action --list`
- `rp view --list`
- `rp model --schema`
- `rp action <name> --schema`

这些命令可用，但 Agent 若要完整理解能力，需要多次调用。

### 建议

1. 增加 `rp capabilities` 或 `rp capabilities`，一次输出：
   - module name/version。
   - model schemaVersion。
   - actions 名称、description、input schema。
   - views 名称、description。
   - 默认路径解析结果。
2. `action --list` 可选 `--with-schema`。
3. view list 可明确标记默认 view 选择结果。

## P2-3: 改进日志查询和审计可比对性

### 现状

日志 JSONL 已包含 id、time、type、reason、patch、input、model hashes 等核心信息。`rp log --limit` 可读取最近记录。

### 建议

1. 增加过滤参数：
   - `--type action`
   - `--name remember`
   - `--since <time>`
   - `--jsonl` 保持原始 JSONL 输出。
2. `hashModel()` 使用稳定 stringify。
3. 对 no-op action 是否记录日志做产品决策：如果 action 表达了重要语义但 patch 为空，可能仍应可选记录。
4. 对 `LOG_WRITE_FAILED` 场景提供更明确的恢复建议。

## P3-1: 同步文档、AGENTS.md 和发布说明

### 现状

`docs/PROGRESS.md` 与当前实现基本同步，README 也已更新为 MVP 完成口径。但 `AGENTS.md` 中仍有多处“命令骨架”“下一阶段 Phase 4”的描述，与当前实现不一致。

### 风险

- 后续 AI Agent 会基于过时上下文做错误判断。
- 新贡献者会误以为 patch/action/schema/log 仍未实现。

### 建议

1. 更新 `AGENTS.md` 的目录结构和阶段说明。
2. 在 README 增加安装方式和最小可运行示例。
3. 在 `examples/life-sim/README.md` 增加“从空目录创建项目”的路径。
4. 增加安全说明：`rp.module.ts` 是本地代码，不要运行未知来源模块。

## P3-2: 小型工程化整理

建议后续顺手处理：

- 为 package 增加 `files`、`engines`、`repository`、`license` 等发布字段。
- 根目录存在 npm workspaces，但旧目录树提到 `pnpm-workspace.yaml`；需要统一包管理器口径。
- `parseLimit()` 使用 `MODEL_INVALID_JSON` 表达 limit 参数错误不够准确，可增加 `CLI_USAGE_ERROR`。
- action/view 名称可增加非空和安全字符校验。
- `writeJsonFileAtomic()` 可考虑 fsync 文件和目录，提高崩溃恢复语义。
- `schema` 导出遇到 Zod transform/refinement 时，应给出更具体的提示或文档限制。

## 建议路线图

### 第一阶段：发布可用性硬化

1. 定义 module loading 支持矩阵和 Node engines。
2. 增加 dist/bin smoke test。
3. 增加 module identity 校验。
4. deep freeze 或 clone action/view model。

### 第二阶段：Agent 调用体验

1. 增加 `rp.config.json` 和向上查找。
2. 支持 stdin 和无输入 action。
3. 增加 capabilities 聚合命令。
4. 统一或显式版本化 CLI 输出 shape。

### 第三阶段：长期运行可靠性

1. lock wait、stale lock 和诊断。
2. log verify/doctor。
3. 稳定 hash 与日志过滤。
4. versioned migrations。

## 结论

RP CLI 当前的核心方向是正确的：它没有尝试做游戏引擎或 jq clone，而是把 Zod schema、JSON Patch、action、view、migration 和 audit log 组织成了一个清晰的model 运行时。最值得优先投入的优化不是新增领域能力，而是把“本地 TypeScript 模块 + model 文件 + 审计日志”这条链路变成在真实用户项目中稳定、可诊断、可恢复的产品级契约。
