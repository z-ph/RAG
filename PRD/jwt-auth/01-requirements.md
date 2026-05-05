# 需求分析

## 问题陈述

当前系统使用 Spring Security 的 HTTP Session（JSESSIONID Cookie）管理认证状态。这在单实例部署下工作正常，但存在以下问题：

- **水平扩展受限**：多实例部署需要 session 粘滞或 session 复制，增加运维复杂度
- **跨域场景不友好**：前后端分离 + 跨域部署时，Cookie-based session 需要额外 CORS 配置
- **移动端/API 调用不便**：Session 机制天然面向浏览器，非浏览器客户端使用体验差

目标：用 JWT 替代 Session，保持现有 RBAC 权限体系（`Role` → `Permission` → `@PreAuthorize`）完全不变。

## 用户故事

1. **作为用户**，我登录后获得 JWT token，后续请求通过 `Authorization: Bearer <token>` 头携带认证信息，而非依赖浏览器 Cookie
2. **作为用户**，我的 Access Token 过期后，前端自动使用 Refresh Token 获取新的 Access Token，无需重新登录
3. **作为管理员**，禁用用户后该用户的 token 在自然过期前仍可使用（不需要黑名单机制），下次 token 刷新时生效
4. **作为开发者**，后端 API 路径不变，响应结构适配 token 字段，仅认证载体从 Cookie 变为 JWT

## 验收标准

1. `POST /api/auth/login` 成功后返回 Access Token 和 Refresh Token，不再依赖 JSESSIONID
2. 后续请求通过 `Authorization: Bearer <access_token>` 认证，不再使用 Cookie session
3. Access Token 过期后，`POST /api/auth/refresh` 可用 Refresh Token 换取新的 token 对
4. Refresh Token 过期后，前端自动跳转到登录页
5. `GET /api/auth/me` 和 `/api/auth/change-password` 必须携带有效 token（从 `permitAll` 移至 `authenticated`）
6. `GET /api/auth/me` 从 JWT 中解析用户身份，行为与现有一致
7. 现有 RBAC 权限校验（`@PreAuthorize` 方法级 + `requestMatchers` URL 级）全部正常工作
8. 前端（React + Vue）自动在请求头附加 token，token 过期时自动刷新（含并发刷新互斥锁）
9. 现有的注册、修改密码、注册码等功能不受影响

## 非功能性需求

- **Token 有效期**：Access Token 30 分钟，Refresh Token 7 天
- **Token 签名**：使用 HMAC-SHA256，密钥至少 256 bits（32 bytes），base64 编码配置在 `application.yaml`
- **无状态**：服务端不存储 session，SecurityConfig 切换为 `STATELESS`
- **向后兼容**：API 路径不变，响应结构适配 token 字段
- **Refresh Token 轮换**：每次 refresh 后旧 Refresh Token 即失效（one-time-use），防止 token 重放
- **前端安全**：token 存储在 `localStorage`（XSS 风险已知，通过输入转义 + CSP 缓解），不使用 `httpOnly` cookie（避免重新引入 CSRF）
- **登出行为**：服务端 logout 为空操作（无状态），前端清除 `localStorage` 并跳转；旧 Access Token 在过期前（最长 30min）仍有效
- **密码修改**：修改密码后旧 token 在过期前仍有效（与禁用用户一致的 accepted trade-off）
- **CORS 调整**：切换到 Bearer token 后，`allowCredentials` 设为 `false`，`allowedOriginPatterns` 保持通配

## 范围外

- Token 黑名单/吊销机制
- OAuth2 / 第三方登录集成
- 移动端适配（仅 Web 前端）
- 数据库 schema 变更（用户/角色/权限表结构不变）
