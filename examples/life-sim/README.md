# Life Sim Example

This example module is a small RP CLI module for a life simulation style state.

It currently exists as a scaffold target for the runtime implementation. Once the CLI commands are implemented, it should support:

```bash
rp --module examples/life-sim/rp.module.ts --state mio.json init
rp --module examples/life-sim/rp.module.ts --state mio.json action remember '{"text":"Mio likes rain."}'
rp --module examples/life-sim/rp.module.ts --state mio.json summary
```
