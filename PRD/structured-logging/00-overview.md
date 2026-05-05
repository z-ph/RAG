# Structured Logging

> 按层分类的结构化日志系统，支持管理员通过前端查看网络层、数据库层、模型会话层的运行日志。

**Status:** review

**Tech stack:** Java Spring Boot + SLF4J/Logback + React/Ant Design

## Git History

| Checkpoint | Hash | Date | Description |
|-----------|------|------|-------------|
| 1         |      |      | Logback 按层按日期分文件配置 |
| 2         |      |      | AOP 切面自动采集数据库层日志 |
| 3         |      |      | 模型会话层日志（RAG pipeline 各节点输入输出） |
| 4         |      |      | 日志查询 REST API |
| 5         |      |      | 前端日志查看页面 |

## Files

- [Requirements Analysis](01-requirements.md)
- [Solution Trade-offs](02-solutions.md)
- [TDD Checkpoints](03-checkpoints.md)
- [Smoke Tests](scripts/)
