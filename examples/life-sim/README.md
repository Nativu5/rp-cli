# Life Sim 示例

这是一个面向生活模拟 / 角色扮演状态的 RP CLI 示例模块。它展示了创作者如何定义 state schema、默认状态、迁移函数、语义 action、summary 和可发现的 JSON Schema。

## 状态模型

`rp.module.ts` 定义了这些作者状态字段：

- `profile`: 角色基本信息，例如 `name`、`age`、`personality`。
- `mood`: 当前情绪，例如 `label`、`valence`、`arousal`、`stress`。
- `relationships`: 以角色名为 key 的关系记录。
- `memories`: 长期记忆列表，支持 `tags` 和 `pinned`。

## 常用命令

初始化状态文件：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json init
```

记录长期记忆：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json \
  --reason "User established this preference." \
  action remember '{"text":"Mio likes rainy afternoons.","tags":["preference"],"pinned":true}'
```

更新心情：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json \
  --reason "Scene tone changed." \
  action setMood '{"label":"flustered but happy","valence":0.68,"arousal":0.4}'
```

使用底层 JSON Patch：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json \
  --reason "Scene moved to a quiet moment." \
  patch '[{"op":"replace","path":"/mood/label","value":"calm"}]'
```

读取默认 summary：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json summary
```

读取 prompt summary：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json summary prompt
```

输出作者 state：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json state
```

结合 `jq` 查询 pinned memories：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json state \
  | jq '.memories[] | select(.pinned == true)'
```

## 能力发现

列出 actions：

```bash
rp --module examples/life-sim/rp.module.ts action --list
```

列出 summaries：

```bash
rp --module examples/life-sim/rp.module.ts summary --list
```

查看 state JSON Schema：

```bash
rp --module examples/life-sim/rp.module.ts schema state
```

查看 `setMood` 输入 schema：

```bash
rp --module examples/life-sim/rp.module.ts schema action setMood
```

## 校验、迁移和日志

验证当前 state：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json validate
```

迁移旧 schemaVersion 的 state：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json migrate
```

读取最近 5 条审计日志：

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json log --limit 5
```

`--reason` 只进入日志，不写入作者 state。
