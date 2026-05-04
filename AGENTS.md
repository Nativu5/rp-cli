# RP-CLI: AI Agent 角色扮演 CLI 框架

**RP CLI 是一个基于 Zod 的命令行模型运行时框架。**

## 技术栈

Node.js · TypeScript · Zod · Commander · fast-json-patch

## 目录结构

- `docs/`：需求、设计与进度文档
- `examples/`：示例模块（如 life-sim）
- `packages/core/`：核心运行时与创作者 API
- `packages/cli/`：命令行工具实现
- `tests/`：端到端与单元测试

## 模块简介

- **@rp-cli/core**：创作者使用的 public API，仅暴露 `defineModule` 及核心类型。
- **@rp-cli/core/internal**：CLI 运行时内部 API，仅供 CLI 使用。
- **@rp-cli/cli**：命令行工具，包含所有 CLI 命令实现。

## 设计原则

- 避免过度设计，保持核心功能的专注和简洁，模块封装自然清晰。
- 代码风格统一，注释清晰，易于维护和扩展。
- 所有注释使用英文。文档推荐使用中文。
- 当前项目是从头开发的新项目，正确性 > 兼容性，为了架构的正确和优雅可以不考虑对旧代码的兼容性。
