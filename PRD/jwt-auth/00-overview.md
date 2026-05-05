# JWT 认证迁移

> 将现有 Session-Based 认证替换为 JWT（Access + Refresh Token 双 token 方案），保持现有 RBAC 架构不变。

**Status:** draft

**Tech stack:** Java Spring Boot (后端) + React/Vue (前端)

## Git History

| Checkpoint | Hash | Date | Description |
|-----------|------|------|-------------|
| 1         |      |      | JWT 工具类 + 登录接口改造 |
| 2         |      |      | JWT 认证过滤器 + SecurityConfig 改造 |
| 3         |      |      | 前端适配（React + Vue） |

## Files

- [需求分析](01-requirements.md)
- [方案对比](02-solutions.md)
- [TDD 检查点](03-checkpoints.md)
- [冒烟测试](scripts/)
