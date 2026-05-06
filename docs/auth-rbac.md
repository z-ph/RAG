# 认证授权模块详解

## 模块总览

基于 Spring Security + JWT 的无状态认证系统，支持 RBAC（基于角色的访问控制）和邀请码注册机制。

**核心类：**
- `com.mark.knowledge.auth.service.AuthService` — 认证业务逻辑
- `com.mark.knowledge.auth.service.UserAccountService` — 用户账号管理
- `com.mark.knowledge.auth.service.RbacService` — RBAC 权限管理
- `com.mark.knowledge.auth.service.JwtUtil` — JWT Token 工具
- `com.mark.knowledge.auth.service.RegistrationCodeService` — 邀请码管理
- `com.mark.knowledge.auth.config.SecurityConfig` — Spring Security 配置
- `com.mark.knowledge.auth.config.JwtAuthenticationFilter` — JWT 过滤器
- `com.mark.knowledge.auth.config.JwtProperties` — JWT 配置属性
- `com.mark.knowledge.auth.config.AuthBootstrapInitializer` — 管理员引导
- `com.mark.knowledge.auth.config.RbacBootstrapInitializer` — 权限引导

---

## Spring Security 配置 (SecurityConfig)

### 过滤器链 (`securityFilterChain`)

**配置要点：**
- **CSRF**: 禁用（无状态 API）
- **CORS**: 通配 `*` 源，所有 HTTP 方法，不允许凭证，缓存 3600 秒
- **Session**: `STATELESS`（无服务端会话）
- **认证方式**: HTTP Basic / Form Login 均禁用，仅 JWT

### URL 权限规则

| 路径 | 权限要求 | 说明 |
|------|----------|------|
| `/rag/**` | `permitAll` | RAG 问答接口公开 |
| `/documents/health` | `permitAll` | 健康检查公开 |
| `/documents/images/**` | `permitAll` | 文档图片公开 |
| `/documents/public/**` | `permitAll` | 公开文档浏览 |
| `/auth/login` | `permitAll` | 登录 |
| `/auth/register` | `permitAll` | 注册 |
| `/auth/logout` | `permitAll` | 登出 |
| `/auth/refresh` | `permitAll` | Token 刷新 |
| `/auth/me` | `authenticated` | 当前用户信息 |
| `/auth/change-password` | `authenticated` | 修改密码 |
| `/auth/registration-codes/**` | `ADMIN` / `SUPER_ADMIN` | 邀请码管理 |
| `/admin/**` | `ADMIN` / `SUPER_ADMIN` | 管理后台 |
| `/documents/**` | `authenticated` | 文档管理（需登录） |
| 其他 | `permitAll` | 默认公开 |

### 异常处理

- **401 未认证**: 返回 JSON `{"error":"未登录","message":"请先登录后再访问该接口"}`
- **403 无权限**: 返回 JSON `{"error":"无权限","message":"当前账号无权执行该操作"}`

### Bean 配置

| Bean | 类型 | 说明 |
|------|------|------|
| `passwordEncoder` | `BCryptPasswordEncoder` | 密码加密 |
| `authenticationManager` | `AuthenticationManager` | 认证管理器 |

---

## JWT 认证流程 (JwtAuthenticationFilter)

**类：** `OncePerRequestFilter` 子类

### `doFilterInternal(HttpServletRequest, HttpServletResponse, FilterChain)`

**流程：**
1. 从 `Authorization` 请求头提取 Bearer Token
2. 无 Token 或非 Bearer 前缀 → 放行（不设置认证上下文）
3. 解析 JWT Claims（`jwtUtil.parseToken`）
4. 拒绝 Refresh Token 被用作 Access Token
5. 从 Claims 提取 `username` 和 `authorities` 列表
6. 构建 `UsernamePasswordAuthenticationToken`（已认证状态）
7. 设置到 `SecurityContextHolder`
8. JWT 解析失败 → 仅 debug 日志，放行（不设置认证上下文）

**特点：** 不抛出异常阻止请求，认证失败由 Spring Security 的授权检查处理（返回 401/403）。

---

## JwtUtil

### Token 生成

#### `generateAccessToken(String username, Long userId, String roleCode, List<String> authorities)`

生成 Access Token。

**Claims：**
| 字段 | 值 | 说明 |
|------|-----|------|
| `sub` | username | 用户名 |
| `userId` | Long | 用户ID |
| `roleCode` | String | 角色代码 |
| `authorities` | List\<String\> | 权限列表（含 ROLE_ 前缀的角色和权限代码） |
| `iat` | Date | 签发时间 |
| `exp` | Date | 过期时间（iat + accessExpiration） |

#### `generateRefreshToken(String username)`

生成 Refresh Token。

**Claims：**
| 字段 | 值 | 说明 |
|------|-----|------|
| `sub` | username | 用户名 |
| `type` | "refresh" | Token 类型标识 |
| `jti` | UUID | 唯一ID（用于 Refresh Token Rotation） |
| `iat` | Date | 签发时间 |
| `exp` | Date | 过期时间（iat + refreshExpiration） |

### Token 解析

#### `parseToken(String token) → Claims`

解析并验证 JWT 签名和有效期。过期抛 `ExpiredJwtException`，无效抛 `JwtException`。

#### `isRefreshToken(Claims claims) → boolean`

检查 Claims 中 `type` 字段是否为 `"refresh"`。

#### `getJti(Claims claims) → String`

获取 Refresh Token 的唯一标识符（jti）。

---

## AuthService

### `login(LoginRequest) → TokenResponse`

用户登录。

**流程：**
1. 用户名规范化（`normalizeUsername`）
2. 密码格式校验（`validatePassword`）
3. `AuthenticationManager.authenticate` 验证凭证
4. 获取用户账号（`getRequiredByUsername`）
5. 生成 Access Token + Refresh Token（`generateAndStoreTokens`）
6. 存储 Refresh Token 的 jti 到用户记录（Refresh Token Rotation）

### `register(RegisterRequest) → TokenResponse`

用户注册。

**流程：**
1. 用户名规范化 + 密码校验
2. 检查用户名可用性（`ensureUsernameAvailable`）
3. 消耗邀请码（`registrationCodeService.consumeCode`）
4. 获取默认角色 `USER`
5. 创建用户（`userAccountService.createUser`）
6. 自动登录，返回 Token

### `logout()`

无操作。JWT 无状态，前端清除 localStorage 即可。

### `getCurrentUser(Authentication) → AuthStatusResponse`

获取当前登录用户信息。未认证返回 `{authenticated: false}`。

### `refresh(String refreshToken) → TokenResponse`

刷新 Token。

**流程：**
1. 解析 Refresh Token
2. 验证 Token 类型为 refresh
3. 获取用户名和 jti
4. 校验 jti 与用户记录一致（防止旧 Token 重放）
5. 生成新的 Token 对
6. 更新用户记录中的 jti（Refresh Token Rotation）

---

## RBAC 权限模型

### 实体关系

```
UserAccount ←→ UserRole ←→ Role ←→ Permission (多对多)
                (分配关系)     (角色)    (权限)
```

### 实体详情

#### UserAccount

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Long | 主键 |
| `username` | String | 用户名（唯一） |
| `password` | String | BCrypt 加密密码 |
| `role` | String | 角色代码（旧字段） |
| `assignedRole` | Role | 关联的角色实体（RBAC） |
| `refreshTokenJti` | String | 当前 Refresh Token 的 jti |
| `enabled` | boolean | 是否启用 |

#### Role

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Long | 主键 |
| `code` | String | 角色代码（如 `ADMIN`, `USER`） |
| `name` | String | 角色显示名 |
| `description` | String | 角色描述 |
| `permissions` | List\<Permission\> | 关联权限列表 |

#### Permission

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Long | 主键 |
| `code` | String | 权限代码（如 `user:read`, `document:delete`） |
| `name` | String | 权限显示名 |
| `description` | String | 权限描述 |

#### RegistrationCode

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Long | 主键 |
| `code` | String | 邀请码 |
| `used` | boolean | 是否已使用 |
| `usedByUsername` | String | 使用者用户名 |
| `createdBy` | String | 创建者用户名 |

---

## 引导初始化

### AuthBootstrapInitializer

应用启动时自动创建管理员账号（如不存在）。

### RbacBootstrapInitializer

应用启动时自动初始化 RBAC 数据：
- 创建预定义角色（`SUPER_ADMIN`, `ADMIN`, `USER`）
- 创建预定义权限（`user:read`, `document:delete` 等）
- 建立角色-权限关联

---

## 方法级安全

通过 `@EnableMethodSecurity` 启用，使用 `@PreAuthorize` 注解：

```java
@PreAuthorize("hasAuthority('user:read')")
public List<UserResponse> listUsers() { ... }

@PreAuthorize("hasRole('ADMIN')")
public void deleteUser(Long userId) { ... }
```

**权限检查优先级：** URL 规则 → `@PreAuthorize` 注解

---

## 管理员操作 (AdminController)

| 端点 | 权限 | 说明 |
|------|------|------|
| `GET /admin/users` | ADMIN | 用户列表 |
| `POST /admin/users` | ADMIN | 创建用户 |
| `PUT /admin/users/{id}` | ADMIN | 更新用户 |
| `DELETE /admin/users/{id}` | ADMIN | 删除用户 |
| `GET /admin/roles` | ADMIN | 角色列表 |
| `POST /admin/roles` | ADMIN | 创建角色 |
| `PUT /admin/roles/{id}` | ADMIN | 更新角色 |
| `GET /admin/permissions` | ADMIN | 权限列表 |
| `POST /auth/registration-codes` | ADMIN | 生成邀请码 |
| `GET /auth/registration-codes` | ADMIN | 邀请码列表 |
