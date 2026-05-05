# 方案对比

## 方案 A：自定义 JWT Filter + 手动 token 管理（推荐）

**原理**：自定义 `JwtAuthenticationFilter` 替代 Spring Security 的 `SessionManagementFilter`。登录时由 `AuthService` 生成 JWT pair，请求时由 Filter 解析并设置 `SecurityContext`。

**实现要点**：
- 新增 `JwtUtil` 工具类：生成/解析/验证 Access Token 和 Refresh Token
- 新增 `JwtAuthenticationFilter`（OncePerRequestFilter）：从 `Authorization` 头提取 token，解析用户身份和权限，填充 `SecurityContext`
- 修改 `SecurityConfig`：session 策略改为 `STATELESS`，注册 JWT Filter 在 `UsernamePasswordAuthenticationFilter` 之前，`allowCredentials` 改为 `false`，`/api/auth/me` 和 `/api/auth/change-password` 从 `permitAll` 移至 `authenticated`
- 修改 `AuthService.login()` 和 `AuthService.register()`：返回 token 对而非依赖 session
- 新增 `POST /api/auth/refresh` 端点：用 Refresh Token 换新 token 对（Refresh Token Rotation：每次刷新后旧 token 失效）
- 前端：`localStorage` 存储 token，fetch 拦截器自动附加 token 和处理 401 刷新（含并发刷新互斥：多个请求同时 401 时只发一个 refresh，其余复用结果）

**优点**：
- 完全掌控 token 生命周期，代码简洁直观
- 与现有 `AuthService`、`UserAccountService` 集成自然
- 无额外依赖（Spring Boot 自带 `jjwt` 或使用 `java-jwt` 即可）
- Refresh Token Rotation 防止 token 重放，仅新增一个 `refreshTokenJti` 字段

**缺点**：
- 需要自己处理 token 刷新的并发问题（通过前端互斥锁模式解决）
- Refresh Token Rotation 需要服务端轻量存储（`UserAccount` 表新增 `refreshTokenJti` 列）

**工作量**：S

## 方案 B：Spring Security OAuth2 Resource Server（jwt()）

**原理**：使用 Spring Security 内置的 `oauth2ResourceServer().jwt()` 支持，让框架处理 JWT 解析和验证。

**实现要点**：
- 引入 `spring-boot-starter-oauth2-resource-server`
- 配置 `JwtDecoder` bean（从 HMAC 密钥构建）
- 自定义 `JwtAuthenticationConverter` 将 JWT claims 映射为 `GrantedAuthority`
- 登录和 token 刷新逻辑仍需自行实现（OAuth2 Resource Server 只负责验证，不负责签发）

**优点**：
- 框架层面的 JWT 验证，经过充分测试
- 与 Spring Security 深度集成

**缺点**：
- 引入 OAuth2 依赖但实际不用 OAuth2 协议，概念上容易混淆
- token 签发（登录）和刷新仍需自己实现，框架只帮了一半
- `JwtAuthenticationConverter` 配置较复杂，尤其是自定义 authorities 映射
- 对于「仅替代 session」这个目标来说过于重量级

**工作量**：M

## 对比

| 维度 | 方案 A（自定义 Filter） | 方案 B（OAuth2 Resource Server） |
|------|------------------------|-------------------------------|
| 简洁性 | 高 | 中（引入不必要的 OAuth2 概念） |
| 依赖增量 | 仅 jjwt 或 nimbus-jose | spring-boot-starter-oauth2-resource-server |
| 与现有代码兼容性 | 高（直接替换 session 逻辑） | 中（需要适配 converter） |
| 维护成本 | 低 | 中 |
| 学习曲线 | 低 | 中 |

## 推荐

**方案 A**。理由：

1. 目标明确——仅替代 session 机制，不需要 OAuth2 的完整协议栈
2. 现有 `AuthService` 的 login/logout 逻辑可以最小改动迁移
3. 依赖少，代码直观，便于后续维护
4. 方案 B 的 OAuth2 Resource Server 在「只做验证不做签发」的场景下反而增加了复杂度

### 依赖选择

推荐使用 `io.jsonwebtoken:jjwt-api` + `jjwt-impl` + `jjwt-jackson`（JJWT 库），它是 Java 生态最成熟的 JWT 库，API 简洁。

### Token 结构设计

**Access Token Payload**:
```json
{
  "sub": "username",
  "userId": 1,
  "roleCode": "ADMIN",
  "authorities": ["ROLE_ADMIN", "user:read", "user:write"],
  "iat": 1714900000,
  "exp": 1714901800
}
```

**Refresh Token Payload**:
```json
{
  "sub": "username",
  "type": "refresh",
  "jti": "unique-token-id",
  "iat": 1714900000,
  "exp": 1715504800
}
```

Refresh Token Rotation 机制：每次 refresh 时生成新 `jti`，存入 `UserAccount.refreshTokenJti`。刷新时验证请求中的 `jti` 与存储值一致，不一致则拒绝（防止重放）。

### 关键文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `pom.xml` | 修改 | 添加 jjwt 依赖 |
| `application.yaml` | 修改 | 添加 jwt.secret, jwt.access-expiration, jwt.refresh-expiration |
| `auth/service/JwtUtil.java` | 新增 | JWT 生成/解析/验证工具类 |
| `auth/config/JwtAuthenticationFilter.java` | 新增 | JWT 认证过滤器 |
| `auth/config/SecurityConfig.java` | 修改 | session 改 STATELESS，注册 JWT filter，allowCredentials 改 false，/me 和 /change-password 移至 authenticated |
| `auth/app/AuthController.java` | 修改 | login/register 返回 token，新增 refresh 端点 |
| `auth/service/AuthService.java` | 修改 | login/register 用 JwtUtil 生成 token，logout 改为空操作 |
| `auth/dto/AuthSuccessResponse.java` | 修改 | 新增 accessToken、refreshToken 字段 |
| `auth/entity/UserAccount.java` | 修改 | 新增 refreshTokenJti 字段（用于 Refresh Token Rotation） |
| `auth/repository/UserAccountRepository.java` | 修改 | 新增 findByUsername 查询（refresh 时用） |
| `frontend/src/lib/api.ts` | 修改 | 核心请求函数添加 Authorization 头，移除 credentials: include，添加 401 拦截和并发刷新互斥锁 |
| `frontend/src/hooks/useAuthSession.ts` | 修改 | 适配 JWT 状态管理（localStorage 存储 token） |
| `front-vue/src/lib/api.ts` | 修改 | 同上（Vue 版） |
| `front-vue/src/composables/useAuthSession.ts` | 修改 | 同上（Vue 版） |
