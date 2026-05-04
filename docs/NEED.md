# RP CLI 简版需求文档

## 1. 项目名称

**RP CLI**

暂定含义：

```text
Roleplay CLI
```

## 2. 项目概述

RP CLI 是一个面向 AI Agent 的命令行model 运行时框架。

创作者通过 TypeScript + Zod 定义model schema、actions 和 views。框架负责model 初始化、验证、JSON Patch 应用、持久化、日志记录和 CLI 暴露。

AI Agent 可以通过 CLI：

```bash
rp view
rp action remember '{"text":"Mio likes rainy afternoons."}' --reason "User mentioned this preference."
rp update '[{"op":"replace","path":"/mood/label","value":"happy"}]' --reason "Mood changed after the scene."
rp model | jq '.mood'
```

本项目不内置具体游戏类型。地牢、恋爱模拟、模拟人生、经营模拟等都由创作者自行定义 schema 和 actions。

---

## 3. 背景

AI Agent 在角色扮演或模拟类应用中经常需要维护长期状态，例如角色信息、关系、记忆、物品、任务、事件等。

如果 Agent 直接修改 JSON 文件，容易出现：

```text
路径写错
结构污染
非法类型
覆盖旧数据
缺少日志
难以审计
无法验证
```

RP CLI 通过 Zod schema 和 JSON Patch 解决这些问题：

```text
创作者定义状态结构
Agent 通过 action 或 patch 提交修改
框架统一验证、应用、落盘和记录日志
```

---

## 4. 项目目标

### 4.1 核心目标

1. 支持创作者定义 Zod model schema。
2. 支持创作者定义 actions，作为语义写接口。
3. 支持创作者定义 views，作为只读上下文接口。
4. 支持标准 JSON Patch 作为底层唯一写入协议。
5. 所有写入必须经过 Zod 验证。
6. 支持 `--reason`，将修改原因写入日志，但不写入 model。
7. 提供 CLI 命令供 Agent 或脚本调用。
8. 遵循 Unix 哲学：原始 model 直接输出，查询过滤交给 jq 等工具。
9. 支持创作者定义 schema version 和 migrate 函数，用于model 版本升级。

### 4.2 非目标

MVP 不做：

```text
不实现 jq-like path 查询
不实现 model get/set/add/remove
不内置 RPG / 恋爱模拟 / 模拟人生 schema
不实现 GUI
不实现 tools 导出
不实现聊天前端
不实现远程模块加载
不实现数据库服务
不实现多步自动迁移编排
```

---

## 5. 目标用户

### 5.1 创作者

创作者编写 `rp.module.ts`，定义：

```text
model schema
model version
defaults
actions
views
migrate
```

### 5.2 AI Agent

Agent 通过 CLI 调用：

```text
view 读取上下文
action 执行业务写入
patch 执行底层写入
model 获取完整原始状态
```

### 5.3 开发者

开发者使用 RP CLI 构建不同类型的角色扮演或模拟应用。

---

## 6. 用户故事

### 6.1 创作者定义状态模型

**作为创作者，**
我希望可以用 Zod 定义自己的状态结构，
以便我可以自由实现地牢、恋爱模拟、模拟人生或其他类型的状态模型。

验收标准：

```text
可以创建 rp.module.ts
可以定义 model.schema
可以定义 model.defaults
rp init 能基于 defaults 初始化model 文件
rp validate 能使用 Zod 验证model 文件
```

---

### 6.2 创作者定义 action

**作为创作者，**
我希望可以定义 action，
以便 Agent 可以通过语义化命令修改状态，而不是直接操作 JSON。

示例：

```bash
rp action remember '{"text":"Mio likes rain."}'
```

验收标准：

```text
action 有 input Zod schema
action 接收当前 model 和 input
action 返回 patch、可选 reason、可选 message
框架自动应用 patch
框架自动验证 patch 后的 model
框架将 action reason 写入日志
框架将 action message 写入 CLI 输出
```

---

### 6.3 创作者定义 view

**作为创作者，**
我希望可以定义 view，
以便 Agent 能获取精简、结构化的当前上下文。

示例：

```bash
rp view
rp view prompt
```

验收标准：

```text
view 可以读取 model
view 不允许写 model
view 输出 JSON
view 输出不强制 Zod 验证
```

---

### 6.4 Agent 调用 action 修改状态

**作为 AI Agent，**
我希望通过 action 修改状态，
以便我不用直接理解底层 JSON 结构。

示例：

```bash
rp action setMood '{"label":"happy","valence":0.7}' \
  --reason "The character became happy after receiving praise."
```

验收标准：

```text
action input 会被验证
action 返回 patch、reason、message
patch 被应用到 model
修改后的 model 会被 Zod 验证
CLI --reason 进入 log
action 返回的 reason 进入 log
reason 不进入 model
action 返回的 message 可进入 CLI 输出
```

---

### 6.5 Agent 使用 patch 作为底层逃生口

**作为 AI Agent，**
我希望可以直接提交标准 JSON Patch，
以便在没有合适 action 时仍然可以修改状态。

示例：

```bash
rp update '[{"op":"replace","path":"/mood/label","value":"calm"}]' \
  --reason "Scene moved to a quiet moment."
```

验收标准：

```text
rp update 使用标准 JSON Patch
patch path 相对于 author model
patch 不能修改 envelope
patch 后必须通过 Zod 验证
验证失败时不落盘
```

---

### 6.6 Agent 读取原始状态

**作为 AI Agent 或脚本，**
我希望可以获取完整原始 model，
以便我可以通过 jq 或其他工具做过滤和转换。

示例：

```bash
rp model | jq '.memories[] | select(.pinned == true)'
```

验收标准：

```text
rp model 输出 author model
rp model --raw 输出完整 envelope
rp-cli 不实现复杂查询能力
```

---

### 6.7 开发者查看日志

**作为开发者，**
我希望可以查看每次写入的日志，
以便追踪状态变化原因和来源。

示例：

```bash
rp log --limit 10
```

验收标准：

```text
action 和 patch 写操作都会记录日志
日志包含 reason
日志包含 action 返回的 reason
日志包含 patch
日志包含操作类型
日志包含 model hash before / after
日志包含 action message
reason 不进入 model
```

---

### 6.8 Agent 或开发者查看 schema 和 actions

**作为 Agent 或开发者，**
我希望可以查看当前模块暴露了哪些 actions 和 schema，
以便知道如何调用系统。

示例：

```bash
rp action --list
rp model --schema
rp action remember --schema
```

验收标准：

```text
rp action --list 输出 action 列表
rp view --list 输出 view 列表
rp action <name> --schema 输出 action 描述和 input schema
rp model --schema 输出 model JSON Schema
schema 转换失败时返回错误
```

---

## 7. 功能需求

## 7.1 模块加载

系统必须支持加载本地 TypeScript 模块：

```bash
rp --module ./rp.module.ts
```

默认路径：

```text
./rp.module.ts
```

模块必须导出：

```ts
export default defineModule(...)
```

---

## 7.2 model 文件

model 文件使用 envelope 格式：

```json
{
  "rp": {
    "module": "life-sim",
    "moduleVersion": 1,
    "schemaVersion": 1,
    "createdAt": "2026-05-03T12:00:00.000Z",
    "updatedAt": "2026-05-03T12:00:00.000Z"
  },
  "model": {}
}
```

规则：

```text
rp 由框架维护
model 由创作者 schema 定义
patch 和 action 只能修改 model
rp.schemaVersion 来自创作者模块中的 model.version
model.version 表示创作者 schema 的版本，不属于 author model
非 migrate 命令遇到旧 schemaVersion 时返回 MIGRATION_REQUIRED
非 migrate 命令遇到更高 schemaVersion 时返回 MIGRATION_FAILED
```

---

## 7.3 初始化

命令：

```bash
rp init
rp init --force
```

功能：

```text
加载模块
调用 defaults
验证 defaults
创建 envelope
将 rp.schemaVersion 设置为 module.model.version
写入model 文件
```

---

## 7.4 验证

命令：

```bash
rp validate
```

功能：

```text
验证 envelope
检查 rp.schemaVersion 与 module.model.version
验证 author model
返回验证结果
```

---

## 7.5 迁移

命令：

```bash
rp migrate
rp migrate --dry-run
```

功能：

```text
加载模块
读取model 文件
当 rp.schemaVersion 低于 module.model.version 时调用 module.model.migrate
migrate 由创作者实现旧 model 到新 model 的转换
验证迁移后的 model
更新 envelope 中的 schemaVersion
写入model 文件
记录日志
```

---

## 7.6 输出状态

命令：

```bash
rp model
rp model --raw
```

功能：

```text
rp model 输出 author model
rp model --raw 输出完整 envelope
```

---

## 7.7 应用 JSON Patch

命令：

```bash
rp update '<json-patch>' --reason '<reason>'
rp update --file patch.json --reason '<reason>'
```

功能：

```text
解析 JSON Patch
支持 fast-json-patch 提供的完整标准 JSON Patch 操作
应用到 model
验证 patch 后的 model
写入model 文件
记录日志
```

---

## 7.8 执行 action

命令：

```bash
rp action <name> '<json-input>' --reason '<reason>'
rp action <name> --file input.json --reason '<reason>'
```

功能：

```text
查找 action
验证 input
执行 action
action 返回 patch、可选 reason、可选 message
框架应用 patch
验证新 model
写入model 文件
记录日志
返回状态修改后的 result 和可选 message
```

---

## 7.9 调用 view

命令：

```bash
rp view
rp view <name>
```

功能：

```text
查找 view
验证 envelope
检查 rp.schemaVersion 与 module.model.version
验证当前 model
调用 view
输出 view JSON
不写 model
只读是作者模块契约，MVP 不强制 deep freeze
```

---

## 7.10 查看 action 和 view

命令：

```bash
rp action --list
rp view --list
```

功能：

```text
列出 action
列出 view
```

---

## 7.11 查看 schema

命令：

```bash
rp model --schema
rp model --schema
rp action <name> --schema
```

功能：

```text
输出 model schema 信息
输出 action input schema 信息
输出格式为 JSON Schema
转换失败返回 SCHEMA_EXPORT_FAILED
```

---

## 7.12 查看日志

命令：

```bash
rp log
rp log --limit 20
```

功能：

```text
读取日志文件
输出最近 N 条日志
```

---

## 8. 非功能需求

### 8.1 数据安全

所有写操作必须：

```text
先验证当前 model
应用 patch
再验证新 model
验证失败不落盘
```

### 8.2 原子写入

写model 文件时必须使用原子写入策略：

```text
写临时文件
rename 替换
避免model 文件损坏
```

### 8.3 文件锁

写操作必须加文件锁：

```text
init
patch
action
migrate
```

锁应覆盖model 文件写入和日志追加，以避免多个 Agent 并发写入同一个 model file。

### 8.4 写入与日志事务

MVP 不要求model 文件写入和日志追加组成原子事务。

```text
model 文件写入必须原子化
日志追加不要求与状态写入事务化
日志失败应返回明确错误，但不要求回滚model 文件
```

### 8.5 JSON 输出

默认输出 JSON。

成功不包裹：

```json
{ "ok": true }
```

失败统一输出：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "model failed validation",
    "details": {}
  }
}
```

### 8.6 CLI 组合性

RP CLI 应遵循 Unix 哲学：

```text
输出 JSON
允许通过管道传给 jq
不重复实现 jq 查询能力
不内置复杂展示层
```

---

## 9. 错误处理

常见错误码：

```text
MODULE_NOT_FOUND
MODULE_INVALID
MODEL_NOT_FOUND
MODEL_INVALID_JSON
MODEL_ENVELOPE_INVALID
VALIDATION_ERROR
PATCH_INVALID
PATCH_FAILED
ACTION_NOT_FOUND
ACTION_INPUT_INVALID
ACTION_RETURN_INVALID
ACTION_RUNTIME_ERROR
VIEW_NOT_FOUND
VIEW_RUNTIME_ERROR
MIGRATION_REQUIRED
MIGRATION_FAILED
SCHEMA_EXPORT_FAILED
WRITE_FAILED
LOG_WRITE_FAILED
MODEL_LOCKED
```

失败示例：

```json
{
  "error": {
    "code": "ACTION_INPUT_INVALID",
    "message": "invalid input for action: remember",
    "details": {
      "issues": [
        {
          "path": "/text",
          "message": "Required"
        }
      ]
    }
  }
}
```

---

## 10. 建议技术栈

```text
Node.js
TypeScript
Zod
Commander
fast-json-patch
Zod JSON Schema export
proper-lockfile
vitest
```

---

## 11. MVP 范围

### 11.1 必须实现

```text
defineModule
模块加载
model envelope
rp init
rp validate
rp migrate
rp model
rp update
rp action
rp view
rp model --schema
rp log
Zod 验证
JSON Patch 应用
reason 日志
schemaVersion
migrate
原子写入
文件锁
示例模块
测试
```

### 11.2 暂不实现

```text
rp tools
rp view
rp model get/set/add/remove
jq-like path
GUI
远程模块加载
多步自动 migration 编排
OpenAI tool spec exporter
```

---

## 12. 示例模块

示例模块应放在：

```text
examples/life-sim/rp.module.ts
```

包含：

```text
model schema
defaults
remember action
setMood action
default view
prompt view
```

示例调用：

```bash
rp --module examples/life-sim/rp.module.ts --model mio.json init

rp --module examples/life-sim/rp.module.ts --model mio.json \
  action remember '{"text":"Mio likes rain.","pinned":true}' \
  --reason "User established this preference."

rp --module examples/life-sim/rp.module.ts --model mio.json view

rp --module examples/life-sim/rp.module.ts --model mio.json model \
  | jq '.memories'
```

---

## 13. 验收标准

项目完成时应满足：

```text
可以创建并加载 rp.module.ts
可以初始化model 文件
可以验证model 文件
可以迁移旧 schemaVersion 的model 文件
可以输出 author model
可以应用标准 JSON Patch
patch 后必须经过 Zod 验证
可以执行 action
action 返回 patch 并由框架应用
view 只读
reason 写入 log 但不写入 model
action/view/schema 可被查看
日志可读取
非法输入返回统一错误 JSON
测试覆盖核心流程
```

---

## 14. 最终定位

RP CLI 的最终定位是：

> 一个遵循 Unix 哲学的 Zod + JSON Patch 命令行model 运行时框架。

它的核心读写模型是：

```text
Read:
  rp view [name]
  rp model | jq ...

Write:
  rp action <name> <json-input> --reason "..."
  rp update <json-patch> --reason "..."
  rp migrate

Safety:
  rp validate
  rp migrate for schemaVersion upgrades
  Zod validation
  JSON Patch only targets author model
  reason only enters log
```

它不替创作者设计游戏，不替 jq 做查询，不替 Agent 推理。
它只负责把创作者定义的状态模型安全、可验证、可审计地暴露给命令行和 AI Agent。
