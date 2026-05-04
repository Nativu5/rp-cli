# RP CLI 代码审查与结构优化方案

本文基于当前 Model/View/Action/Update 重构后的代码进行审查，重点关注：

- 模块间是否存在交叉引用或边界失控。
- 源文件是否过度平铺，导致职责不清。
- 后续继续演进时，哪些结构问题会最先放大维护成本。

## 总体判断

当前代码没有发现明确的循环导入。`@rp-cli/core` 与 `@rp-cli/cli` 的包级方向仍然正确：CLI 依赖 core，core 不依赖 CLI；public creator API 也没有暴露 loader、lock、log、validation 等 runtime-only 能力。

真正的问题不是“已经出现硬循环”，而是已经出现了 **软交叉引用**：

- `@rp-cli/core/internal` 暴露范围过宽，几乎把所有内部模块都通过 barrel export 暴露给 CLI。
- CLI 命令层直接拼装 runtime 事务流程，包含加载模块、加锁、读取 model、校验、执行 action/update/migrate、写回、记录日志等业务编排。
- core 源文件虽然单个文件不算大，但整体按技术能力横向平铺，领域边界不够强。

如果继续沿用当前结构，短期功能仍能推进；但一旦增加事务语义、快照、profiles、doctor、日志校验、插件化 loader 或更复杂 migration，复杂度会集中堆到 CLI 命令文件和 `core/internal` 出口上。

## 审查发现

| 优先级 | 问题                                      | 当前表现                                                 | 风险                                                |
| ------ | ----------------------------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| P1     | `@rp-cli/core/internal` 内部 API 出口过宽 | `internal.ts` 对 action/model/log/lock 等全部 `export *` | CLI 可随意组合底层能力，边界无法约束。              |
| P1     | CLI 命令层承担 runtime use case 编排      | `action/update/migrate/init` 重复手写读写事务流程        | 后续改日志、锁、dry-run、事务语义时容易行为不一致。 |
| P2     | core 源文件按技术平铺                     | model、validation、action、view、migration 等同级排列    | 领域关系不直观，新模块容易继续横向堆文件。          |
| P2     | 部分文件职责混合                          | `modelFile.ts` 同时处理路径、JSON、envelope、原子写入    | 单点改动容易牵动多个概念。                          |
| P2     | 缺少架构约束测试                          | 只测试 public API 未暴露 runtime-only API                | 重构后无法防止 CLI 再次直接依赖底层 helper。        |

## 关键问题分析

### P1: `core/internal` 过宽

当前 `packages/core/src/internal.ts` 使用大范围 barrel export：

```ts
export * from "./action.js";
export * from "./errors.js";
export * from "./log.js";
export * from "./migration.js";
export * from "./moduleLoader.js";
export * from "./moduleParser.js";
export * from "./patch.js";
export * from "./schema.js";
export * from "./modelFile.js";
export * from "./modelLock.js";
export * from "./modelAccess.js";
export * from "./view.js";
export * from "./types.js";
export * from "./validation.js";
```

这让 `@rp-cli/core/internal` 变成“所有内部实现的总出口”。虽然这个出口没有暴露给创作者 public API，但它对 CLI 来说仍然过宽。

更合理的边界是：

- CLI 只依赖稳定的 runtime use case。
- lock、repository、validation、patch apply、audit log 等低层能力只在 core 内部被 use case 组合。
- `internal.ts` 明确导出 CLI 需要的少数入口，而不是所有底层工具。

### P1: CLI 命令层编排了业务事务

当前 `packages/cli/src/commands/action.ts` 和 `update.ts` 都直接导入大量内部 helper，例如：

- `loadModule`
- `readModelFile`
- `validateModelFile`
- `withModelLock`
- `applyJsonPatch`
- `validateAuthorModel`
- `updateModelEnvelope`
- `writeJsonFileAtomic`
- `appendJsonLogEntry`
- `hashModel`

这说明 CLI 命令层已经不只是“解析参数并输出结果”，而是在实现 runtime 事务。

这个问题短期不一定导致 bug，但会产生长期维护成本：

- `dry-run` 的语义需要在多个命令中重复维护。
- 日志字段调整需要同时改 action/update/migrate。
- 锁策略调整需要检查所有写命令是否一致。
- 未来如果引入事务、快照或 recovery，CLI 文件会继续膨胀。

### P2: 源文件平铺导致领域边界不明显

当前 core 源文件大致是：

```text
action.ts
defineModule.ts
errors.ts
log.ts
migration.ts
modelAccess.ts
modelFile.ts
modelLock.ts
moduleLoader.ts
moduleParser.ts
patch.ts
schema.ts
types.ts
validation.ts
view.ts
```

这些文件数量不算失控，但它们都是横向能力文件。随着功能增加，很容易继续出现：

- `config.ts`
- `doctor.ts`
- `profile.ts`
- `snapshot.ts`
- `transaction.ts`
- `project.ts`

最终 core 会变成一组平铺 helper，而不是围绕 Model/View/Action/Update 的领域模块。

### P2: 职责混合点

`modelFile.ts` 当前同时承担：

- 默认路径和环境变量解析。
- model/log/lock 路径派生。
- JSON 文件读取。
- model envelope 读取。
- envelope 创建和更新。
- 原子 JSON 写入。

这些能力都和 model 持久化相关，但不是同一层职责。建议拆分为：

- path resolver
- model repository
- envelope builder
- atomic JSON writer

`validation.ts` 当前也同时承担：

- envelope shape parse。
- module identity 检查。
- schemaVersion 检查。
- author model Zod 校验。

建议拆到 model validation / envelope validation / compatibility policy 中，至少在目录层面区分清楚。

## 推荐目标架构

建议采用“领域模块 + runtime use case”的轻量结构，不引入复杂框架，也不做过早抽象。

目标目录可以调整为：

```text
packages/core/src/
  public/
    defineModule.ts
    types.ts

  shared/
    errors.ts
    runtimeContext.ts

  module/
    parser.ts
    loader.ts

  model/
    types.ts
    paths.ts
    envelope.ts
    repository.ts
    validation.ts
    lock.ts
    access.ts

  update/
    patch.ts

  action/
    registry.ts
    executor.ts

  view/
    registry.ts
    executor.ts

  migration/
    executor.ts

  audit/
    log.ts

  runtime/
    usecases/
      initModel.ts
      readModel.ts
      validateModel.ts
      applyUpdate.ts
      runAction.ts
      runView.ts
      migrateModel.ts
      readLog.ts

  index.ts
  internal.ts
```

### 分层规则

推荐依赖方向：

```text
public -> shared
domain modules -> shared
runtime/usecases -> domain modules + shared
cli -> core/internal usecases only
```

具体约束：

- `packages/cli` 不直接依赖 `model/lock`、`model/repository`、`model/validation`、`audit/log`、`update/patch`。
- CLI 只依赖 `@rp-cli/core/internal` 中导出的 runtime use case。
- `public` 不依赖 runtime、repository、lock、log、module loader。
- `action/view/migration/update` 不直接写文件，只返回领域执行结果。
- 文件写入、加锁、日志记录由 runtime use case 统一编排。

## Runtime Use Case 设计

use case 层是本次优化的核心。它应该把当前散落在 CLI 命令里的流程收回 core。

示例接口：

```ts
export async function runActionUseCase(input: {
  paths: RpPaths;
  name: string;
  input: unknown;
  dryRun?: boolean;
  reason?: string;
}): Promise<{
  result: null | {
    patch: JsonPatch;
    model: unknown;
  };
  message?: string;
}>;
```

CLI 命令层应简化为：

```ts
const input = await readJsonInput(...);
const result = await runActionUseCase({
  paths,
  name,
  input,
  dryRun,
  reason
});
writeJson(result, pretty);
```

这样可以把以下策略集中到一个地方：

- lock 获取和释放。
- model 读取和校验。
- action/update/migrate 执行。
- dry-run 行为。
- model 写回。
- audit log 写入。
- hash 计算。
- 错误码映射。

## `internal.ts` 收窄方案

当前 `internal.ts` 不建议继续作为全量 barrel。建议改成显式导出：

```ts
export { RpError, toErrorShape } from "./shared/errors.js";
export { resolveRpPaths } from "./model/paths.js";

export { initModelUseCase } from "./runtime/usecases/initModel.js";
export { readModelUseCase } from "./runtime/usecases/readModel.js";
export { validateModelUseCase } from "./runtime/usecases/validateModel.js";
export { applyUpdateUseCase } from "./runtime/usecases/applyUpdate.js";
export { runActionUseCase } from "./runtime/usecases/runAction.js";
export { runViewUseCase } from "./runtime/usecases/runView.js";
export { migrateModelUseCase } from "./runtime/usecases/migrateModel.js";
export { readLogUseCase } from "./runtime/usecases/readLog.js";
```

如测试确实需要底层 helper，应优先从相对路径测试 core 内部模块，而不是让 CLI 通过 `internal` 使用这些 helper。

## 分阶段路线图

### 阶段 1: 增加 use case 层

目标：先不移动大量文件，只把 CLI 命令中的业务流程迁入 core。

建议步骤：

1. 新增 `packages/core/src/runtime/usecases/`。
2. 为现有命令逐个创建 use case：
   - `initModelUseCase`
   - `readModelUseCase`
   - `validateModelUseCase`
   - `applyUpdateUseCase`
   - `runActionUseCase`
   - `runViewUseCase`
   - `migrateModelUseCase`
   - `readLogUseCase`
3. CLI 命令改为只负责参数解析、调用 use case、输出 JSON。
4. 保持现有测试全部通过。

这是最高价值的一步，因为它直接解决 CLI 与 core 内部 helper 的交叉引用。

### 阶段 2: 收窄 `@rp-cli/core/internal`

目标：让 internal API 从“全部内部工具出口”变成“CLI runtime API”。

建议步骤：

1. `internal.ts` 改为显式导出 use case、错误类型、路径解析等少量入口。
2. 更新 CLI import。
3. 更新测试中对 core 内部 helper 的 import，必要时改为相对路径。
4. 增加测试，确保 CLI 命令文件不再导入底层 helper 名称。

### 阶段 3: 按领域移动 core 文件

目标：解决源文件平铺问题，但避免夹带行为变更。

建议步骤：

1. 先做纯移动：
   - `moduleLoader.ts` -> `module/loader.ts`
   - `moduleParser.ts` -> `module/parser.ts`
   - `modelFile.ts` -> `model/repository.ts` 或继续拆分
   - `modelLock.ts` -> `model/lock.ts`
   - `modelAccess.ts` -> `model/access.ts`
   - `patch.ts` -> `update/patch.ts`
   - `log.ts` -> `audit/log.ts`
   - `action.ts` -> `action/executor.ts`
   - `view.ts` -> `view/executor.ts`
   - `migration.ts` -> `migration/executor.ts`
2. 更新 import 路径。
3. 每移动一组文件就运行 typecheck/test。
4. 不在这个阶段改逻辑，降低回归风险。

### 阶段 4: 拆分混合职责文件

目标：进一步清晰化 model 持久化和校验边界。

建议拆分：

- `model/paths.ts`: `resolveRpPaths`、默认路径、环境变量。
- `model/envelope.ts`: `createModelEnvelope`、`updateModelEnvelope`。
- `model/repository.ts`: `readModelFile`、`writeModelFileAtomic`。
- `model/jsonFile.ts`: 通用 JSON 读写和原子写入。
- `model/validation.ts`: `parseEnvelope`、`validateModelFile`、`validateAuthorModel`。
- `model/compatibility.ts`: module identity 和 schemaVersion 策略。

### 阶段 5: 增加架构约束测试

目标：防止结构再次退化。

建议新增测试：

1. CLI 命令文件不能直接导入底层 helper：

```text
packages/cli/src/commands/*.ts
  allowed from @rp-cli/core/internal:
    use cases
    RpError
    resolveRpPaths if needed
```

2. public API 不允许导出 runtime-only 名称：

```text
parseModule
loadModule
readModelFile
withModelLock
appendJsonLogEntry
validateModelFile
```

3. core 内部依赖方向检查：

```text
runtime/usecases -> domain/shared
domain -> shared
shared -> no project-local dependency
public -> shared only
```

## 建议优先级

| 顺序 | 工作项                      | 收益                       | 风险 |
| ---- | --------------------------- | -------------------------- | ---- |
| 1    | 新增 runtime use case 层    | 立刻降低 CLI/core 交叉引用 | 中   |
| 2    | 收窄 `core/internal` 导出   | 固化边界，防止继续泄漏     | 中   |
| 3    | 按领域移动 core 文件        | 改善可读性和长期可维护性   | 低   |
| 4    | 拆分 `modelFile/validation` | 进一步降低单文件职责混合   | 中   |
| 5    | 增加架构约束测试            | 防止后续重构后结构回退     | 低   |

## 最终建议

建议优先执行 **阶段 1 + 阶段 2**。这两步能解决当前最真实的架构问题：CLI 命令层与 core 底层 helper 的软交叉引用。

文件平铺问题可以随后处理。当前文件数量还没有严重失控，因此不建议一开始就大规模移动目录。更稳妥的顺序是：

1. 先把行为编排收敛进 runtime use case。
2. 再收窄 `internal.ts`。
3. 最后按领域移动文件并增加架构测试。

这样可以让每一步都有明确收益，并且每一步都能通过现有测试验证行为未变。
