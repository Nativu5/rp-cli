# RP CLI 最终版设计方案

## 0. 一句话定义

**RP CLI 是一个基于 Zod 的命令行状态运行时框架。**

创作者定义：

```text
Zod state schema
schema version
actions
summaries
defaults
migrate function
```

框架提供：

```text
init
validate
state 输出
patch 应用
action 执行
summary 调用
migrate 执行
schema/action/summary 查询
log
```

Agent 通过 CLI 调用：

```text
rp summary      读取创作者定义的上下文摘要
rp action       调用创作者定义的语义写操作
rp patch        使用标准 JSON Patch 直接修改 state
rp migrate      将旧 schemaVersion 的 state 迁移到当前 schemaVersion
rp state        输出完整原始 state，后接 jq 等工具处理
```

核心思想：

> **创作者负责定义世界状态和语义函数；框架负责验证、补丁、持久化和审计。**

---

# 1. 核心设计原则

## 1.1 不内置具体游戏类型

框架不内置：

```text
profile
mood
inventory
wear
relationship
quest
memory
event
```

这些都属于创作者 schema。

地牢、恋爱模拟、模拟人生、经营模拟、RPG、卡牌游戏都应通过不同的 `rp.module.ts` 实现。

---

## 1.2 底层唯一写入协议是 JSON Patch

框架不实现：

```text
state get
state set
state add
state remove
jq-like path
自定义 path editor
```

底层写入只有：

```bash
rp patch <json-patch>
```

所有变更最终都表达为标准 JSON Patch。

例如：

```bash
rp patch '[{"op":"replace","path":"/mood/label","value":"happy"}]'
```

JSON Patch 的 path **相对于作者定义的 `state` 根节点**，不是完整状态文件 envelope。

也就是说：

```json
{
  "rp": {},
  "state": {
    "mood": {
      "label": "calm"
    }
  }
}
```

执行：

```json
[
  {
    "op": "replace",
    "path": "/mood/label",
    "value": "happy"
  }
]
```

修改的是：

```text
state.mood.label
```

而不是：

```text
rp.mood.label
```

也不是：

```text
/state/mood/label
```

---

## 1.3 `rp patch` 是强大的逃生口，但不能绕过 Zod

`rp patch` 可以绕过创作者 action 的业务逻辑，但不能绕过状态 schema。

也就是说：

```text
rp patch 可以直接修改 state
但修改后的 state 必须通过创作者 Zod schema
否则不落盘
```

这保证了：

```text
业务逻辑可绕过
数据结构不可破坏
底层存储不可破坏
```

---

## 1.4 action = may write

Action 是创作者定义的语义写接口。

Action：

```text
可以读取当前 state
可以接收 input
可以计算 JSON Patch
可以产生状态变更
```

但 action 不直接写文件。

Action 的职责是：

```text
input + current state + context -> JSON Patch
```

框架职责是：

```text
校验 input
执行 action
校验 patch
apply patch
校验 next state
写入 state file
记录 log
返回修改结果
```

---

## 1.5 summary = must not write

Summary 是创作者定义的只读接口。

Summary：

```text
可以读取 state
可以返回任意 JSON
不允许产生状态变更
不写文件
不写 log 中的状态变更
```

Summary 输出不强制 Zod 验证。

原因：

```text
summary 是视图 / 摘要 / 上下文生成函数
不是状态本身
不应该被 state schema 限制
```

---

## 1.6 原始数据交给 Unix 管道处理

`rp state` 直接输出完整作者 state。

如果需要筛选、排序、格式化、转换：

```bash
rp state | jq '.mood.label'
rp state | jq '.memories[] | select(.pinned == true)'
rp summary prompt | jq '.important'
```

框架不重复实现 jq 能力。

---

# 2. 项目边界

## 2.1 RP CLI 是什么

RP CLI 是：

```text
Zod schema runtime
JSON Patch applicator
Agent action runner
summary provider
state validator
state persistence layer
audit logger
CLI bridge
```

## 2.2 RP CLI 不是什么

RP CLI 不是：

```text
jq clone
数据库
游戏引擎
聊天前端
剧情生成器
固定 RPG CLI
固定恋爱模拟 CLI
完整工具调用平台
```

---

# 3. 核心对象

## 3.1 Module

创作者模块文件，默认命名：

```text
rp.module.ts
```

模块定义：

```text
name
version
state.version
state.schema
state.defaults
actions
summaries
state.migrate
```

---

## 3.2 State File

状态文件由框架 envelope 和作者 state 组成。

```json
{
  "rp": {
    "module": "life-sim",
    "moduleVersion": 1,
    "schemaVersion": 1,
    "createdAt": "2026-05-03T12:00:00.000Z",
    "updatedAt": "2026-05-03T12:00:00.000Z"
  },
  "state": {
    "profile": {},
    "mood": {},
    "memories": []
  }
}
```

其中：

```text
rp     框架元信息
state  创作者定义的数据
```

`rp patch`、`rp action` 只能修改 `state`。

框架内部负责更新：

```text
rp.updatedAt
rp.module
rp.moduleVersion
rp.schemaVersion
```

Agent 和创作者不应通过 patch 修改 `rp` 元信息。

`rp.schemaVersion` 来自创作者模块中的 `state.version` 字段。这个字段表示创作者 schema 的版本，不属于作者 state 数据。

当状态文件中的 `rp.schemaVersion` 小于当前模块的 `state.version` 时，框架通过创作者提供的 `state.migrate` 函数迁移 state。迁移逻辑由创作者负责实现，框架只负责调用、验证、写入和记录日志。

---

## 3.3 JSON Patch

所有底层状态变更都使用标准 JSON Patch 数组。

示例：

```json
[
  {
    "op": "replace",
    "path": "/mood/label",
    "value": "happy"
  },
  {
    "op": "add",
    "path": "/memories/-",
    "value": {
      "id": "mem_001",
      "text": "Mio likes rain.",
      "createdAt": "2026-05-03T12:30:00.000Z"
    }
  }
]
```

JSON Patch path 相对于 `state` 根节点。

---

## 3.4 Action

Action 是创作者定义的写函数。

Action 有：

```text
description
input Zod schema
run function
```

Action run 返回 patch、可选 reason、可选 message。

MVP action 返回格式：

```ts
type ActionResult = {
  patch: JsonPatch;
  reason?: string;
  message?: string;
};
```

解释：

```text
patch 用于底层状态修改。
reason 是 action 生成的日志说明，不写入 state。
message 是 action 显式设置的 CLI 返回消息，不写入 state。
```

CLI 暴露的 action 返回值由框架生成：

```text
result  状态修改后的结果；如果没有任何修改则为空。
message action 返回的 message；如果没有设置则省略。
```

---

## 3.5 Summary

Summary 是创作者定义的只读函数。

Summary 有：

```text
name
description 可选
run function
```

Summary 输入：

```text
readonly state
meta
```

Summary 输出：

```text
任意 JSON
```

Summary 输出不需要 Zod 验证。

---

# 4. CLI 总览

命令名暂定：

```bash
rp
```

也可以发布为：

```bash
rp-cli
```

## 4.1 全局参数

```bash
rp --module ./rp.module.ts --state ./rp.state.json <command>
```

全局参数：

| 参数                | 含义                      |
| ----------------- | ----------------------- |
| `--module <path>` | 模块文件路径                  |
| `--state <path>`  | 状态文件路径                  |
| `--pretty`        | 美化 JSON 输出              |
| `--dry-run`       | 对写操作只预览，不落盘             |
| `--reason <text>` | 写操作原因，只进入 log，不进入 state |

环境变量：

```bash
RP_MODULE=./rp.module.ts
RP_STATE=./rp.state.json
```

优先级：

```text
CLI 参数 > 环境变量 > 默认值
```

默认值：

```text
module: ./rp.module.ts
state: ./rp.state.json
```

---

# 5. 最终命令集

MVP 命令：

```text
rp init
rp validate
rp migrate
rp state
rp patch
rp action
rp summary
rp schema
rp log
```

不提供：

```text
rp state get
rp state set
rp state add
rp state remove
rp view
rp tools
```

---

# 6. 命令详细设计

## 6.1 `rp init`

初始化状态文件。

```bash
rp init
rp init --state mio.json
rp init --force
```

行为：

```text
1. 加载 module。
2. 调用 module.state.defaults。
3. 用 module.state.schema 验证 defaults。
4. 包装为 envelope，并将 rp.schemaVersion 设置为 module.state.version。
5. 写入 state file。
6. 返回完整 envelope。
```

成功输出：

```json
{
  "rp": {
    "module": "life-sim",
    "moduleVersion": 1,
    "schemaVersion": 1,
    "createdAt": "2026-05-03T12:00:00.000Z",
    "updatedAt": "2026-05-03T12:00:00.000Z"
  },
  "state": {
    "profile": {},
    "mood": {},
    "memories": []
  }
}
```

规则：

```text
如果状态文件已存在，默认失败。
--force 允许覆盖。
```

---

## 6.2 `rp validate`

验证当前状态文件。

```bash
rp validate
```

行为：

```text
1. 加载 module。
2. 读取 state file。
3. 验证 envelope。
4. 检查 rp.schemaVersion 是否等于 module.state.version。
5. 用创作者 Zod schema 验证 state。
6. 返回验证结果。
```

成功输出：

```json
{
  "valid": true,
  "module": "life-sim",
  "moduleVersion": 1,
  "schemaVersion": 1
}
```

失败输出：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "state failed validation",
    "issues": [
      {
        "path": "/mood/valence",
        "message": "Expected number, received string"
      }
    ]
  }
}
```

---

## 6.3 `rp migrate`

将旧 schemaVersion 的状态文件迁移到当前 schemaVersion。

```bash
rp migrate
rp migrate --dry-run
```

行为：

```text
1. 加载 module。
2. 读取 state file。
3. 验证 envelope。
4. 如果 rp.schemaVersion 等于 module.state.version，返回无需迁移的结果。
5. 如果 rp.schemaVersion 高于 module.state.version，返回 MIGRATION_FAILED。
6. 如果缺少 module.state.migrate，返回 MIGRATION_REQUIRED。
7. 调用 module.state.migrate。
8. 用 module.state.schema 验证迁移后的 state。
9. 将 rp.schemaVersion 更新为 module.state.version。
10. 如果 --dry-run，返回预览，不写入。
11. 否则原子写入 state file。
12. 记录 log。
13. 返回迁移结果。
```

示例输出：

```json
{
  "fromVersion": 1,
  "toVersion": 2,
  "state": {
    "profile": {},
    "mood": {},
    "memories": []
  }
}
```

---

## 6.4 `rp state`

输出完整作者 state。

```bash
rp state
```

输出：

```json
{
  "profile": {},
  "mood": {},
  "memories": []
}
```

如果需要完整 envelope：

```bash
rp state --raw
```

输出：

```json
{
  "rp": {
    "module": "life-sim",
    "moduleVersion": 1,
    "schemaVersion": 1,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "state": {
    "profile": {},
    "mood": {},
    "memories": []
  }
}
```

读取局部数据不由 RP CLI 实现。

例如：

```bash
rp state | jq '.mood.label'
rp state | jq '.memories[] | select(.pinned == true)'
```

---

## 6.5 `rp patch`

应用标准 JSON Patch。

```bash
rp patch '[{"op":"replace","path":"/mood/label","value":"happy"}]'
```

从文件读取：

```bash
rp patch --file update.patch.json
```

带 reason：

```bash
rp patch '[{"op":"replace","path":"/mood/label","value":"happy"}]' \
  --reason "Mio became happier after talking with Haru."
```

dry run：

```bash
rp patch --dry-run '[{"op":"replace","path":"/mood/label","value":"happy"}]'
```

行为：

```text
1. 加载 module。
2. 读取 state file。
3. 验证 envelope。
4. 检查 rp.schemaVersion 是否等于 module.state.version。
5. 验证当前 state。
6. 解析 JSON Patch。
7. 使用 fast-json-patch 校验完整标准 JSON Patch 格式。
8. 将 patch 应用到 state。
9. 用 Zod 验证 next state。
10. 如果 --dry-run，返回预览，不写入。
11. 否则原子写入。
12. 记录 log，包括 reason。
13. 返回 patch 应用结果。
```

成功输出建议：

```json
{
  "patch": [
    {
      "op": "replace",
      "path": "/mood/label",
      "value": "happy"
    }
  ],
  "state": {
    "profile": {},
    "mood": {
      "label": "happy"
    },
    "memories": []
  }
}
```

注意：

```text
rp patch 的 path 永远相对于 author state。
rp patch 不能修改 envelope 的 rp 元信息。
rp patch 不能绕过 Zod schema。
```

---

## 6.6 `rp action`

执行创作者 action。

```bash
rp action remember '{"text":"Mio likes rainy afternoons.","tags":["preference"]}'
```

带 reason：

```bash
rp action remember '{"text":"Mio likes rainy afternoons.","tags":["preference"]}' \
  --reason "The user mentioned this preference in the current scene."
```

从文件读取 input：

```bash
rp action remember --file input.json
```

列出可用 actions：

```bash
rp action --list
```

行为：

```text
1. 如果传入 --list，加载 module，输出 action 列表，不读取 state file。
2. 否则加载 module。
3. 查找 action。
4. 读取 state file。
5. 验证 envelope。
6. 检查 rp.schemaVersion 是否等于 module.state.version。
7. 验证当前 state。
8. 解析 input JSON。
9. 用 action.input Zod schema 验证 input。
10. 调用 action.run。
11. action.run 返回 patch、可选 reason、可选 message。
12. 校验 patch 格式。
13. 将 patch 应用到 state。
14. 用 state schema 验证 next state。
15. 如果 --dry-run，返回预览，不写入。
16. 否则原子写入。
17. 记录 log，包括 input、patch、CLI reason、action reason、message。
18. 返回状态修改后的 result 和可选 message。
```

MVP action 返回：

```ts
{
  patch: JsonPatch;
  reason?: string;
  message?: string;
}
```

CLI 成功输出由框架生成，不直接暴露创作者自定义 result。

示例成功输出：

```json
{
  "result": {
    "patch": [
      {
        "op": "add",
        "path": "/memories/-",
        "value": {
          "id": "mem_001",
          "text": "Mio likes rainy afternoons.",
          "tags": ["preference"],
          "pinned": false,
          "createdAt": "2026-05-03T12:30:00.000Z"
        }
      }
    ],
    "state": {
      "profile": {},
      "mood": {},
      "memories": [
        {
          "id": "mem_001",
          "text": "Mio likes rainy afternoons.",
          "tags": ["preference"],
          "pinned": false,
          "createdAt": "2026-05-03T12:30:00.000Z"
        }
      ]
    }
  },
  "message": "Memory recorded."
}
```

如果 action 的 patch 为空，则输出：

```json
{
  "result": null,
  "message": "No state changes were needed."
}
```

---

## 6.7 `rp action --list`

列出创作者定义的 actions。

```bash
rp action --list
```

输出：

```json
[
  {
    "name": "remember",
    "description": "Add a long-term memory."
  },
  {
    "name": "setMood",
    "description": "Update current mood."
  }
]
```

说明：

```text
rp action --list 是 Agent 发现写能力的重要接口。
单个 action 的 input JSON Schema 通过 rp schema action <name> 查看。
rp action --help 保持 Commander 内置静态帮助语义，不加载创作者模块。
不再提供 rp tools。
不提供独立 actions 子命令，避免和 rp summary 的调用风格不一致。
```

---

## 6.8 `rp summary`

调用创作者 summary。

```bash
rp summary
rp summary brief
rp summary prompt
rp summary debug
rp summary --list
```

规则：

```text
rp summary 默认调用 default summary。
如果没有 default，则调用 brief。
如果没有 brief，则调用第一个 summary。
rp summary --list 输出可用 summaries，不读取 state file。
```

Summary 必须只读。

只读是作者模块契约。MVP 不对传入的 state 做 deep freeze；如果 summary 或 action 在运行时主动修改了传入对象，属于作者模块实现问题。

行为：

```text
1. 加载 module。
2. 读取 state file。
3. 验证 envelope。
4. 检查 rp.schemaVersion 是否等于 module.state.version。
5. 验证当前 state。
6. 调用 summary function。
7. 输出 summary 结果。
8. 不写入 state。
```

示例输出：

```json
{
  "profile": {
    "name": "Mio"
  },
  "mood": {
    "label": "happy"
  },
  "importantMemories": [
    "Mio likes rainy afternoons."
  ]
}
```

Summary 输出不强制 Zod 验证。

---

## 6.9 `rp schema`

输出创作者 schema 信息。

```bash
rp schema
rp schema state
rp schema action remember
```

目标：

```text
让 Agent / 开发者理解 state shape 和 action input。
```

输出必须是 JSON Schema。

MVP 要求：

```text
rp schema state 输出 state schema 的 JSON Schema。
rp schema action <name> 输出 action input schema 的 JSON Schema。
```

如果 Zod 到 JSON Schema 转换失败，返回 `SCHEMA_EXPORT_FAILED`。

---

## 6.10 `rp log`

输出操作日志。

```bash
rp log
rp log --limit 20
```

默认日志文件：

```text
<state-file>.log.jsonl
```

例如：

```text
rp.state.json.log.jsonl
```

日志条目示例：

```json
{
  "id": "log_001",
  "time": "2026-05-03T12:30:00.000Z",
  "type": "action",
  "name": "remember",
  "reason": "The user mentioned this preference in the current scene.",
  "actionReason": "A long-term memory was added.",
  "message": "Memory recorded.",
  "input": {
    "text": "Mio likes rainy afternoons.",
    "tags": ["preference"]
  },
  "patch": [
    {
      "op": "add",
      "path": "/memories/-",
      "value": {
        "id": "mem_001",
        "text": "Mio likes rainy afternoons.",
        "tags": ["preference"],
        "createdAt": "2026-05-03T12:30:00.000Z"
      }
    }
  ],
  "stateHashBefore": "sha256:...",
  "stateHashAfter": "sha256:..."
}
```

Reason 和 message 只进入 log / CLI 输出，不进入 state。

---

# 7. 作者模块 API

## 7.1 defineModule

```ts
import { z } from "zod";
import { defineModule } from "@rp-cli/core";

export default defineModule({
  name: "life-sim",
  version: 1,

  state: {
    version: 1,
    schema: StateSchema,
    defaults: () => ({
      profile: {},
      mood: {},
      memories: []
    }),
    migrate: ({ state }) => state
  },

  actions: {
    remember: {
      description: "Add a long-term memory.",
      input: z.object({
        text: z.string(),
        tags: z.array(z.string()).default([]),
        pinned: z.boolean().default(false)
      }),
      run({ state, input, ctx }) {
        const memory = {
          id: ctx.id("mem"),
          text: input.text,
          tags: input.tags,
          pinned: input.pinned,
          createdAt: ctx.now()
        };

        return {
          patch: [
            {
              op: "add",
              path: "/memories/-",
              value: memory
            }
          ],
          reason: "A long-term memory was added.",
          message: "Memory recorded."
        };
      }
    }
  },

  summaries: {
    default({ state }) {
      return {
        profile: state.profile,
        mood: state.mood,
        pinnedMemories: state.memories.filter((m) => m.pinned)
      };
    }
  }
});
```

---

## 7.2 Module 类型草案

```ts
export interface RpModule<TState = unknown> {
  name: string;
  version: number;

  state: {
    version: number;
    schema: ZodType<TState>;
    defaults: () => TState | Promise<TState>;
    migrate?: RpMigration<TState>;
  };

  actions?: Record<string, RpAction<TState, any>>;

  summaries?: Record<string, RpSummary<TState>>;
}
```

---

## 7.3 Migration 类型

```ts
export interface RpMigration<TState = unknown> {
  (args: {
    state: unknown;
    fromVersion: number;
    toVersion: number;
    meta: RpMeta;
    ctx: RpMigrationContext;
  }): TState | Promise<TState>;
}
```

迁移函数由创作者自行实现旧版本 state 到当前版本 state 的转换。框架不会自动推断字段变化，只负责调用该函数、验证返回值、更新 `rp.schemaVersion` 并写入日志。

```ts
export interface RpMigrationContext {
  now(): string;
  id(prefix?: string): string;
}
```

---

## 7.4 Action 类型

```ts
export interface RpAction<TState, TInput> {
  description: string;
  input: ZodType<TInput>;

  run(args: {
    state: Readonly<TState>;
    input: TInput;
    meta: RpMeta;
    ctx: RpActionContext;
  }): RpActionReturn | Promise<RpActionReturn>;
}
```

```ts
export type RpActionReturn = {
  patch: JsonPatch;
  reason?: string;
  message?: string;
};
```

---

## 7.5 Summary 类型

```ts
export interface RpSummary<TState> {
  description?: string;

  run(args: {
    state: Readonly<TState>;
    meta: RpMeta;
  }): unknown | Promise<unknown>;
}
```

为了简化作者体验，也允许：

```ts
summaries: {
  default({ state }) {
    return ...
  }
}
```

即 summary 可以是函数，框架自动包装。

---

## 7.6 Action Context

```ts
export interface RpActionContext {
  now(): string;
  id(prefix?: string): string;
}
```

MVP 提供：

```text
ctx.now()
ctx.id(prefix)
```

不提供直接写 state 的 API。

---

# 8. State Envelope

## 8.1 类型

```ts
export interface RpStateFile<TState> {
  rp: RpMeta;
  state: TState;
}
```

```ts
export interface RpMeta {
  module: string;
  moduleVersion: number;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

## 8.2 规则

```text
作者 schema 只验证 state。
框架 envelope 由框架验证。
patch/action 只能修改 state。
rp meta 由框架维护。
rp.schemaVersion 必须等于 module.state.version，除非正在执行 migrate。
非 migrate 命令遇到旧 schemaVersion 时返回 MIGRATION_REQUIRED。
非 migrate 命令遇到比当前 module.state.version 更高的 schemaVersion 时返回 MIGRATION_FAILED。
```

---

# 9. JSON Patch 设计

## 9.1 Patch 类型

```ts
export type JsonPatch = JsonPatchOperation[];
```

支持标准操作：

```text
add
remove
replace
move
copy
test
```

MVP 直接使用 `fast-json-patch` 提供完整标准 JSON Patch 支持，不自研操作子集。

## 9.2 Patch path

Path 使用 JSON Pointer：

```text
/mood/label
/memories/-
/memories/0/text
/relationships/Haru/affection
```

不支持 jq-like：

```text
.mood.label
.memories[id=mem_001]
```

如果需要按 id 修改数组对象，建议通过 action 实现，而不是底层 patch。

例如：

```bash
rp action pinMemory '{"id":"mem_001"}'
```

Action 内部根据 state 查找 index，然后返回：

```json
[
  {
    "op": "replace",
    "path": "/memories/0/pinned",
    "value": true
  }
]
```

---

# 10. 写操作统一流程

所有写操作，包括：

```text
rp patch
rp action
rp init
rp migrate
```

都必须遵守写入流程。

## 10.1 `rp patch` 流程

```text
load module
load state file
validate envelope
check schemaVersion equals module.state.version
validate current state by Zod
parse patch
validate full JSON Patch syntax with fast-json-patch
apply patch to state clone
validate next state by Zod
if dry-run:
  output preview
  exit
update rp.updatedAt
atomic write state file
append log
output result
```

## 10.2 `rp action` 流程

```text
load module
find action
load state file
validate envelope
check schemaVersion equals module.state.version
validate current state by Zod
parse input JSON
validate input by action.input
run action with readonly state by contract
validate returned { patch, reason?, message? }
validate full JSON Patch syntax with fast-json-patch
apply patch to state clone
validate next state by Zod
if dry-run:
  output preview
  exit
update rp.updatedAt
atomic write state file
append log
output generated result and optional message
```

## 10.3 `rp migrate` 流程

```text
load module
load state file
validate envelope
compare rp.schemaVersion with module.state.version
if versions match:
  output no-op result
  exit
if state file version is newer:
  return MIGRATION_FAILED
if module.state.migrate is missing:
  return MIGRATION_REQUIRED
run module.state.migrate with state, fromVersion, toVersion, meta, ctx
validate migrated state by module.state.schema
if dry-run:
  output preview
  exit
update rp.schemaVersion
update rp.updatedAt
atomic write state file
append log
output migrated state result
```

---

# 11. Reason 设计

## 11.1 用法

```bash
rp action remember '{"text":"Mio likes rain."}' \
  --reason "The character expressed this preference."

rp patch '[{"op":"replace","path":"/mood/label","value":"happy"}]' \
  --reason "Mood changed after a successful date."
```

Action 也可以返回 reason：

```ts
return {
  patch,
  reason: "setMood normalized the current mood fields",
  message: "Mood updated."
};
```

## 11.2 规则

```text
CLI --reason 是调用方提供的操作原因。
action return reason 是创作者 action 生成的补充原因。
两者只进入 log。
两者都不进入 state。
两者都不参与 schema validation。
两者都不改变 action input。
```

## 11.3 设计目的

Reason 对应 ST MVU 中 Analysis 的作用：

```text
解释为什么要做这次状态更新
供审计、调试、回放、Agent 自我修正使用
不作为世界事实保存
```

如果某个原因本身需要成为长期事实，应通过 action 或 patch 显式写入 state。

---

# 12. 输出规范

## 12.1 成功输出

成功不包：

```json
{ "ok": true }
```

不同命令直接输出其结果：

```text
rp state      输出 state
rp summary    输出 summary
rp action     输出 action result
rp patch      输出 patch apply result
rp migrate    输出 migration result
rp validate   输出 validation result
rp schema     输出 schema
rp log        输出 log entries
```

## 12.2 失败输出

统一错误格式：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "state failed validation",
    "details": {}
  }
}
```

## 12.3 Exit Codes

```text
0  success
1  generic error
2  cli usage error
3  module error
4  state file error
5  validation error
6  action error
7  patch error
8  write/lock error
```

---

# 13. 错误码

MVP 错误码：

```text
MODULE_NOT_FOUND
MODULE_INVALID
STATE_NOT_FOUND
STATE_INVALID_JSON
STATE_ENVELOPE_INVALID
VALIDATION_ERROR
PATCH_INVALID
PATCH_FAILED
ACTION_NOT_FOUND
ACTION_INPUT_INVALID
ACTION_RETURN_INVALID
ACTION_RUNTIME_ERROR
SUMMARY_NOT_FOUND
SUMMARY_RUNTIME_ERROR
MIGRATION_REQUIRED
MIGRATION_FAILED
SCHEMA_EXPORT_FAILED
WRITE_FAILED
LOG_WRITE_FAILED
STATE_LOCKED
```

示例：

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

# 14. Schema 设计

## 14.1 Zod 是作者和框架的契约

作者通过 Zod 定义 state schema 和 action input schema。

框架使用 Zod：

```text
验证 defaults
验证当前 state
验证 action input
验证 patch 后 next state
导出 schema 信息
```

## 14.2 State schema

作者可以定义任何 state schema。

示例：

```ts
const StateSchema = z.object({
  profile: z.object({
    name: z.string().optional(),
    age: z.number().optional()
  }).catchall(z.unknown()),

  mood: z.object({
    label: z.string().optional(),
    valence: z.number().min(-1).max(1).optional()
  }).catchall(z.unknown()),

  memories: z.array(z.object({
    id: z.string(),
    text: z.string(),
    pinned: z.boolean().default(false),
    createdAt: z.string()
  })).default([])
});
```

## 14.3 schema 输出

`rp schema` 必须输出 JSON Schema。

如果 Zod 到 JSON Schema 转换失败，返回 `SCHEMA_EXPORT_FAILED`，不输出 best-effort 自定义格式。

---

# 15. Log 设计

## 15.1 日志文件

默认：

```text
<state-file>.log.jsonl
```

每行一条 JSON。

## 15.2 Patch log

```json
{
  "id": "log_001",
  "time": "2026-05-03T12:00:00.000Z",
  "type": "patch",
  "reason": "Mood changed after date.",
  "patch": [
    {
      "op": "replace",
      "path": "/mood/label",
      "value": "happy"
    }
  ],
  "stateHashBefore": "sha256:...",
  "stateHashAfter": "sha256:..."
}
```

## 15.3 Action log

```json
{
  "id": "log_002",
  "time": "2026-05-03T12:30:00.000Z",
  "type": "action",
  "name": "remember",
  "reason": "The user mentioned this preference.",
  "actionReason": "A long-term memory was added.",
  "message": "Memory recorded.",
  "input": {
    "text": "Mio likes rain."
  },
  "patch": [
    {
      "op": "add",
      "path": "/memories/-",
      "value": {
        "id": "mem_001",
        "text": "Mio likes rain.",
        "createdAt": "2026-05-03T12:30:00.000Z"
      }
    }
  ],
  "stateHashBefore": "sha256:...",
  "stateHashAfter": "sha256:..."
}
```

## 15.4 Migration log

```json
{
  "id": "log_003",
  "time": "2026-05-03T13:00:00.000Z",
  "type": "migrate",
  "fromVersion": 1,
  "toVersion": 2,
  "stateHashBefore": "sha256:...",
  "stateHashAfter": "sha256:..."
}
```

日志追加失败不要求回滚状态文件，但必须返回 `LOG_WRITE_FAILED`，让调用方知道审计日志不完整。

---

# 16. 安全与一致性

## 16.1 原子写入

写操作必须：

```text
写临时文件
fsync 可选
rename 替换
```

避免写坏状态文件。

## 16.2 文件锁

写操作加锁：

```text
init
patch
action
migrate
```

读操作可以不加锁，MVP 简化处理。
更安全实现可在读时等待写锁。

锁路径默认使用：

```text
<state-file>.lock
```

锁必须覆盖读取当前 state、验证、计算 next state、原子写入 state file、追加 log 的完整写流程，以避免多个 Agent 并发调用导致写入互相覆盖。

## 16.3 状态写入与日志事务

MVP 不实现状态文件和日志文件之间的原子事务。

```text
state file 必须原子写入。
log append 不要求和 state file write 一起提交或回滚。
如果 log append 失败，状态文件不回滚，CLI 返回 LOG_WRITE_FAILED。
```

## 16.4 模块执行风险

`rp.module.ts` 是本地代码，具有本地执行能力。

文档必须说明：

```text
只运行可信模块。
不要运行未知来源的 rp.module.ts。
```

---

# 17. 推荐技术栈

```text
TypeScript
Node.js
Zod
cac 或 commander
tsx 或 jiti
fast-json-patch
zod-to-json-schema
proper-lockfile
nanoid
vitest
fs-extra
```

建议包结构：

```text
@rp-cli/core
@rp-cli/cli
```

---

# 18. 项目结构

```text
rp-cli/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── defineModule.ts
│   │   │   ├── types.ts
│   │   │   ├── moduleLoader.ts
│   │   │   ├── stateFile.ts
│   │   │   ├── validation.ts
│   │   │   ├── migration.ts
│   │   │   ├── patch.ts
│   │   │   ├── action.ts
│   │   │   ├── summary.ts
│   │   │   ├── schema.ts
│   │   │   ├── log.ts
│   │   │   ├── errors.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── cli/
│       ├── src/
│       │   ├── cli.ts
│       │   ├── commands/
│       │   │   ├── init.ts
│       │   │   ├── validate.ts
│       │   │   ├── migrate.ts
│       │   │   ├── state.ts
│       │   │   ├── patch.ts
│       │   │   ├── action.ts
│       │   │   ├── summary.ts
│       │   │   ├── schema.ts
│       │   │   └── log.ts
│       │   └── output.ts
│       └── package.json
│
├── examples/
│   ├── life-sim/
│   │   ├── rp.module.ts
│   │   └── README.md
│   └── dungeon/
│       ├── rp.module.ts
│       └── README.md
│
├── tests/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── README.md
```

---

# 19. 示例模块：life-sim

```ts
import { z } from "zod";
import { defineModule } from "@rp-cli/core";

const MemorySchema = z.object({
  id: z.string(),
  text: z.string(),
  tags: z.array(z.string()).default([]),
  pinned: z.boolean().default(false),
  createdAt: z.string()
});

const StateSchema = z.object({
  profile: z.object({
    name: z.string().optional(),
    age: z.number().optional(),
    personality: z.array(z.string()).optional()
  }).catchall(z.unknown()).default({}),

  mood: z.object({
    label: z.string().optional(),
    valence: z.number().min(-1).max(1).optional(),
    arousal: z.number().min(0).max(1).optional(),
    stress: z.number().min(0).max(1).optional()
  }).catchall(z.unknown()).default({}),

  relationships: z.record(z.object({
    affection: z.number().min(0).max(100).optional(),
    trust: z.number().min(0).max(100).optional(),
    notes: z.array(z.string()).default([])
  }).catchall(z.unknown())).default({}),

  memories: z.array(MemorySchema).default([])
});

export default defineModule({
  name: "life-sim",
  version: 1,

  state: {
    version: 1,
    schema: StateSchema,
    defaults: () => ({
      profile: {},
      mood: {},
      relationships: {},
      memories: []
    }),
    migrate: ({ state }) => state
  },

  actions: {
    remember: {
      description: "Add a long-term memory.",
      input: z.object({
        text: z.string(),
        tags: z.array(z.string()).default([]),
        pinned: z.boolean().default(false)
      }),
      run({ input, ctx }) {
        const memory = {
          id: ctx.id("mem"),
          text: input.text,
          tags: input.tags,
          pinned: input.pinned,
          createdAt: ctx.now()
        };

        return {
          patch: [
            {
              op: "add",
              path: "/memories/-",
              value: memory
            }
          ],
          reason: "A long-term memory was added.",
          message: "Memory recorded."
        };
      }
    },

    setMood: {
      description: "Update current mood.",
      input: z.object({
        label: z.string().optional(),
        valence: z.number().min(-1).max(1).optional(),
        arousal: z.number().min(0).max(1).optional(),
        stress: z.number().min(0).max(1).optional()
      }),
      run({ input }) {
        const patch = Object.entries(input).map(([key, value]) => ({
          op: "add",
          path: `/mood/${key}`,
          value
        }));

        return {
          patch,
          reason: "Mood fields were updated.",
          message: "Mood updated."
        };
      }
    }
  },

  summaries: {
    default({ state }) {
      return {
        profile: state.profile,
        mood: state.mood,
        relationshipCount: Object.keys(state.relationships).length,
        pinnedMemories: state.memories.filter((m) => m.pinned)
      };
    },

    prompt({ state }) {
      return {
        character: state.profile,
        currentMood: state.mood,
        importantMemories: state.memories
          .filter((m) => m.pinned)
          .map((m) => m.text)
      };
    }
  }
});
```

---

# 20. 示例调用

初始化：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json init
```

写入 action：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json \
  action remember '{"text":"Mio likes rainy afternoons.","tags":["preference"],"pinned":true}' \
  --reason "User established this preference in dialogue."
```

更新心情：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json \
  action setMood '{"label":"flustered but happy","valence":0.68}' \
  --reason "Haru complimented Mio directly."
```

底层 patch：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json \
  patch '[{"op":"replace","path":"/mood/label","value":"calm"}]' \
  --reason "Scene moved to a quiet moment."
```

读取 summary：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json summary
```

读取原始 state 并交给 jq：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json state \
  | jq '.memories[] | select(.pinned == true)'
```

查看 actions：

```bash
rp --module examples/life-sim/rp.module.ts action --list
```

验证：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json validate
```

迁移：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json migrate
```

查看日志：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json log --limit 5
```

---

# 21. MVP 范围

## 必须实现

```text
defineModule
module loader
state envelope
init
validate
migrate
state
patch
action
summary
schema
log
Zod validation
JSON Patch apply
reason logging
schemaVersion
migrate function
atomic write
basic file lock
life-sim example
tests
```

## 暂不实现

```text
tools
view
state get/set/add/remove
jq-like path
多步自动 migration 编排
GUI
daemon
remote module loading
OpenAI tool spec exporter
```

---

# 22. 测试计划

## 22.1 单元测试

```text
defineModule accepts valid module
defineModule rejects invalid module
init writes envelope
validate passes valid state
validate fails invalid state
migrate upgrades old schemaVersion
migrate returns no-op when schemaVersion matches
patch applies valid JSON Patch
patch rejects invalid JSON Patch
patch rejects schema-violating result
action validates input
action rejects invalid input
action applies returned patch
action rejects invalid returned patch
summary returns data without writing
reason appears in log but not state
state outputs author state only
state --raw outputs envelope
```

## 22.2 集成测试

```text
life-sim init
life-sim action remember
life-sim action setMood
life-sim summary
life-sim patch
life-sim validate
life-sim migrate
life-sim state | jq
invalid patch
invalid action input
schema violation after patch
```

## 22.3 CLI 测试

检查：

```text
stdout
stderr
exit code
state file content
log file content
```

---

# 23. 最终架构总结

```text
Creator
  defines Zod schema
  defines schema version
  defines migrate function
  defines actions: input -> patch
  defines summaries: state -> json

Agent
  reads via summary or state
  writes via action or patch
  explains writes via --reason

Framework
  loads module
  validates state
  applies JSON Patch
  migrates old schemaVersion
  validates next state
  persists atomically
  logs every write
```

最终读写模型：

```text
Read:
  rp summary [name]
  rp state | jq ...

Write:
  rp action <name> <json-input> --reason "..."
  rp patch <json-patch> --reason "..."
  rp migrate

Safety:
  rp validate
  rp migrate for schemaVersion upgrades
  Zod schema validation before and after writes
  JSON Patch never touches envelope
  reason never enters state
```

最终定位：

> **RP CLI 是一个遵循 Unix 哲学的 Zod + JSON Patch 状态运行时框架。它不替创作者设计游戏，不替 jq 做查询，不替 Agent 推理；它只把创作者定义的状态模型安全、可验证、可审计地暴露给命令行和 Agent。**
