# TDD 检查点

## Checkpoint 1: JWT 工具类 + 登录接口改造

**目标**：实现 JWT 生成/解析能力，改造登录接口返回 token 对。

**先写的测试：**
- 目标：`JwtUtilTest` 单元测试 + `AuthControllerTest` 登录接口测试
- 验证：
  - `JwtUtil` 能正确生成 Access Token 和 Refresh Token
  - 生成的 token 能被正确解析，提取出 username、userId、authorities
  - 过期 token 解析时抛出 `ExpiredJwtException`
  - 无效签名 token 解析时抛出异常
  - `POST /api/auth/login` 返回 `accessToken` 和 `refreshToken` 字段
  - `POST /api/auth/register` 同样返回 token 对（不再依赖 session）
  - 登录/注册成功后不再创建 HTTP session
- 前置条件：无

**验收标准：**
1. `JwtUtil` 可生成和解析两种 token（access / refresh），Refresh Token 包含 `jti`
2. `POST /api/auth/login` 返回 `{ accessToken, refreshToken, user }` 而非依赖 session
3. `POST /api/auth/register` 同样返回 token 对
4. Access Token 包含 `sub`（username）、`userId`、`roleCode`、`authorities` claims
5. 上述所有测试通过

**Git hash:** ``

**冒烟测试：** `./scripts/smoke-test checkpoint-1`

---

## Checkpoint 2: JWT 认证过滤器 + SecurityConfig 改造

**目标**：JWT Filter 解析请求中的 token 填充 SecurityContext，Spring Security 切换为无状态模式。

**先写的测试：**
- 目标：`JwtAuthenticationFilterTest` 单元测试 + 集成测试
- 验证：
  - 携带有效 `Authorization: Bearer <token>` 的请求能通过认证
  - 不携带 token 的请求到受保护端点返回 401（包括 `/api/auth/me`）
  - 携带过期 token 的请求返回 401
  - 携带无效 token 的请求返回 401
  - `@PreAuthorize("hasAuthority('user:read')")` 方法级权限校验基于 JWT 中的 authorities 正常工作
  - `requestMatchers(...).hasAnyRole(...)` URL 级权限校验正常工作
  - `GET /api/auth/me` 从 JWT 中解析用户信息返回正确结果
  - `POST /api/auth/refresh` 能用 Refresh Token 换取新 token 对
  - 用过的 Refresh Token 不能再次使用（Rotation 防重放）
  - 用 Access Token 调用 refresh 端点应返回 401
  - SecurityConfig session 策略为 `STATELESS`，不再创建 session
- 前置条件：Checkpoint 1 完成

**验收标准：**
1. `JwtAuthenticationFilter` 正确提取并验证 Bearer token
2. RBAC 权限校验（`@PreAuthorize`, URL 规则）从 JWT authorities 中生效
3. `POST /api/auth/refresh` 端点正常工作
4. Session 不再被创建（`STATELESS`）
5. 现有注册、修改密码功能不受影响

**Git hash:** ``

**冒烟测试：** `./scripts/smoke-test checkpoint-2`

---

## Checkpoint 3: 前端适配（React + Vue）

**目标**：两个前端项目从 Cookie-based session 切换到 JWT Bearer token。

**先写的测试：**
- 目标：手动浏览器测试（前端变更以手动验证为主）
- 验证：
  - 登录后 token 存储到 `localStorage`
  - 所有 API 请求自动携带 `Authorization: Bearer <token>` 头（包括 `requestJson`、`requestText` 和独立 fetch 调用）
  - Access Token 过期时自动通过 Refresh Token 刷新，含并发刷新互斥锁（多个请求同时 401 时只发一个 refresh）
  - Refresh Token 过期时跳转到登录页
  - 登出时清除 `localStorage` 中的 token
  - 刷新页面后登录状态保持（从 `localStorage` 恢复）
  - Admin 相关页面权限控制正常
  - 不再使用 `credentials: "include"`
- 前置条件：Checkpoint 2 完成

**验收标准：**
1. React 前端完整 JWT 生命周期正常工作
2. Vue 前端完整 JWT 生命周期正常工作
3. 不再发送 `credentials: "include"`（不再依赖 Cookie）
4. `GET /api/auth/me` 改为基于 JWT 而非 session

**Git hash:** ``

**冒烟测试：** `./scripts/smoke-test checkpoint-3`

---

## 进度

- [ ] Checkpoint 1: JWT 工具类 + 登录接口
- [ ] Checkpoint 2: JWT 认证过滤器 + SecurityConfig
- [ ] Checkpoint 3: 前端适配
