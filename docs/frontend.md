# 前端应用详解

## 概述

项目包含两个独立的前端应用，功能对等但技术栈不同：

| 项目 | 框架 | UI库 | 路由 | 构建工具 |
|------|------|------|------|----------|
| `frontend/` | React 19 | antd 6 | react-router-dom 7 | Vite 8 |
| `front-vue/` | Vue 3.5 | ant-design-vue 4 | vue-router 4 | Vite 8 |

两者共用：Tailwind CSS 4、TypeScript 6、pnpm、Playwright E2E 测试。

---

## frontend/（React 版）

### 技术栈

| 依赖 | 版本 | 用途 |
|------|------|------|
| react / react-dom | 19.2 | UI 框架 |
| antd | 6.3 | 组件库 |
| @ant-design/icons | 6.1 | 图标 |
| react-router-dom | 7.14 | 路由 |
| react-markdown + remark-gfm + remark-breaks | - | Markdown 渲染 |
| dayjs | - | 日期处理 |
| vite | 8.0 | 构建工具 |
| tailwindcss | 4.2 | CSS 工具类 |
| @playwright/test | 1.51 | E2E 测试 |

### 路由结构

Base path: `/rag`

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | ChatPage | 聊天主页（RAG 问答） |
| `/documents` | DocumentsLayout | 文档浏览布局 |
| `/documents/` | DocumentsIndexPage | 文档列表 |
| `/documents/:documentId` | DocumentDetailPage | 文档详情 |
| `/admin` | AdminDashboard | 管理面板（需 ADMIN 角色） |
| `/admin/users` | UserManagement | 用户管理 |
| `/admin/roles` | RoleManagement | 角色管理 |
| `/admin/permissions` | PermissionManagement | 权限管理 |
| `/admin/registration-codes` | RegistrationCodeManagement | 邀请码管理 |
| `/admin/prompts` | PromptManagement | Prompt 管理 |
| `/admin/logs` | LogViewer | 日志查看 |
| `/admin/change-password` | ChangePassword | 修改密码 |

所有 `/admin/*` 路由通过 `AdminRoutes` 组件保护：未登录跳转 `/`，非 ADMIN/SUPER_ADMIN 显示 403。

所有页面使用 `React.lazy` + `Suspense` 懒加载。

### 目录结构

```
frontend/src/
├── main.tsx                         # 入口
├── App.tsx                          # 根组件（路由配置）
├── pages/                           # 页面组件
│   ├── ChatPage.tsx                 # 聊天主页
│   ├── DocumentsLayout.tsx          # 文档布局（侧边栏+内容）
│   ├── DocumentsIndexPage.tsx       # 文档列表页
│   ├── DocumentDetailPage.tsx       # 文档详情页
│   └── documentsShared.ts           # 文档页共享逻辑
├── components/                      # 通用组件
│   ├── ChatWorkspace.tsx            # 聊天工作区（消息列表+输入框）
│   ├── AuthPanel.tsx                # 登录/注册面板
│   ├── MessageBubble.tsx            # 消息气泡（含思考过程、来源引用）
│   ├── MarkdownContent.tsx          # Markdown 内容渲染
│   ├── DocumentSidebar.tsx          # 文档侧边栏
│   ├── DocumentDetail.tsx           # 文档详情视图
│   ├── DocumentDownloadModal.tsx    # 文档下载弹窗
│   ├── DocumentAdmin.tsx            # 文档管理（上传、删除、重索引）
│   ├── ChangePassword.tsx           # 修改密码
│   ├── LazyPageFallback.tsx         # 懒加载占位
│   └── admin/                       # 管理后台组件
│       ├── AdminLayout.tsx          # 管理布局（侧边导航）
│       ├── AdminDashboard.tsx       # 仪表盘
│       ├── UserManagement.tsx       # 用户 CRUD
│       ├── RoleManagement.tsx       # 角色 CRUD
│       ├── PermissionManagement.tsx # 权限列表
│       ├── RegistrationCodeManagement.tsx # 邀请码管理
│       ├── PromptManagement.tsx     # Prompt 管理
│       └── LogViewer.tsx            # 日志查看器
├── hooks/                           # 自定义 Hooks
│   ├── useAuthSession.ts            # 认证会话管理（登录状态、Token 刷新）
│   ├── useRagConversation.ts        # RAG 对话管理（SSE 流式通信）
│   └── useDocumentLibrary.ts        # 文档库管理（列表、上传、删除）
├── lib/                             # 工具库
│   ├── api.ts                       # 后端 API 调用封装
│   ├── httpClient.ts                # HTTP 客户端（带 Token 刷新拦截器）
│   ├── authStore.ts                 # 认证状态管理
│   ├── tokenStorage.ts              # Token 持久化（localStorage）
│   ├── adminApi.ts                  # 管理端 API 调用
│   ├── chat.ts                      # 聊天相关工具
│   ├── sse.ts                       # SSE 连接管理
│   ├── chatHistory.ts               # 聊天历史持久化
│   └── uuid.ts                      # UUID 生成
└── types.ts                         # 类型定义
    types/admin.ts                   # 管理端类型
```

### 核心 Hooks

#### `useAuthSession(message)`

认证会话管理 Hook。

**返回值：**
| 字段 | 类型 | 说明 |
|------|------|------|
| `authStatus` | AuthStatusResponse | 当前认证状态 |
| `authLoading` | boolean | 是否正在加载认证状态 |
| `handleLogin` | function | 登录处理 |
| `handleLogout` | function | 登出处理 |
| `handleRegister` | function | 注册处理 |

**行为：**
- 启动时调用 `GET /auth/me` 检查登录状态
- Token 过期时自动使用 Refresh Token 刷新
- 刷新失败则清除本地 Token

#### `useRagConversation()`

RAG 对话管理 Hook。

**功能：**
- 管理对话消息列表
- SSE 流式接收 AI 回复（thinking_delta + delta 事件）
- 取消生成
- 清空会话

#### `useDocumentLibrary()`

文档库管理 Hook。

**功能：**
- 文档列表获取
- 流式上传（SSE 进度事件）
- 文档删除
- 文档重索引

### HTTP 客户端 (`httpClient.ts`)

基于 `fetch` 的 HTTP 客户端，核心特性：

- **Token 注入**: 每个请求自动附加 `Authorization: Bearer {token}`
- **401 自动刷新**: 收到 401 时自动使用 Refresh Token 刷新，重试原请求
- **刷新失败处理**: 清除本地 Token，触发重新登录

---

## front-vue/（Vue 版）

### 技术栈

| 依赖 | 版本 | 用途 |
|------|------|------|
| vue | 3.5 | UI 框架 |
| ant-design-vue | 4.2 | 组件库 |
| @ant-design/icons-vue | 7.0 | 图标 |
| vue-router | 4.6 | 路由 |
| marked | 18.0 | Markdown 渲染 |
| highlight.js | 11.11 | 代码高亮 |
| vite | 8.0 | 构建工具 |
| tailwindcss | 4.2 | CSS 工具类 |

### 目录结构

```
front-vue/src/
├── main.ts                          # 入口
├── App.vue                          # 根组件（主题配置）
├── router/
│   └── index.ts                     # 路由配置
├── views/                           # 页面组件
│   ├── ChatPage.vue                 # 聊天主页
│   └── AdminPage.vue                # 管理后台
├── components/                      # 通用组件
│   ├── ChatWorkspace.vue            # 聊天工作区
│   ├── AuthPanel.vue                # 登录/注册面板
│   ├── MessageBubble.vue            # 消息气泡
│   ├── MarkdownContent.vue          # Markdown 渲染
│   ├── DocumentSidebar.vue          # 文档侧边栏
│   ├── DocumentDetail.vue           # 文档详情
│   ├── HealthBadge.vue              # 服务健康状态徽章
│   └── admin/                       # 管理后台组件
│       ├── AdminLayout.vue
│       ├── AdminDashboard.vue
│       ├── UserManagement.vue
│       ├── RoleManagement.vue
│       ├── PermissionManagement.vue
│       ├── RegistrationCodeManagement.vue
│       ├── PromptManagement.vue
│       ├── ChangePassword.vue
│       └── DocumentAdmin.vue
├── composables/                     # 组合式函数（Vue Hooks）
│   ├── useAuthSession.ts            # 认证会话
│   ├── useRagConversation.ts        # RAG 对话
│   ├── useDocumentLibrary.ts        # 文档库
│   ├── useAdminState.ts             # 管理后台状态
│   ├── useChatHistory.ts            # 聊天历史
│   ├── useServiceHealth.ts          # 服务健康检查
│   └── useViewportWidth.ts          # 视口宽度响应
├── lib/                             # 工具库
│   ├── api.ts                       # API 调用
│   ├── tokenStorage.ts              # Token 持久化
│   ├── adminApi.ts                  # 管理端 API
│   ├── chat.ts                      # 聊天工具
│   ├── sse.ts                       # SSE 连接
│   ├── chatHistory.ts               # 聊天历史
│   └── uuid.ts                      # UUID
└── types.ts                         # 类型定义
    types/admin.ts                   # 管理端类型
```

### Vue 独有特性

- **HealthBadge** — 显示后端服务健康状态（React 版无此组件）
- **useServiceHealth** — 定时轮询 `/rag/health` 检查服务可用性
- **useViewportWidth** — 响应式视口宽度（移动端适配）
- **主题配置** — 在 `App.vue` 中配置 ant-design-vue 主题：
  - 主色：`#f25b2a`（橙红色）
  - 成功色：`#1d8f6f`
  - 圆角：22px
  - 字体：Space Grotesk + Noto Sans SC

---

## 两个版本的对应关系

| React (frontend/) | Vue (front-vue/) | 说明 |
|-------------------|------------------|------|
| `hooks/useAuthSession.ts` | `composables/useAuthSession.ts` | 认证会话 |
| `hooks/useRagConversation.ts` | `composables/useRagConversation.ts` | RAG 对话 |
| `hooks/useDocumentLibrary.ts` | `composables/useDocumentLibrary.ts` | 文档管理 |
| `lib/api.ts` | `lib/api.ts` | API 调用 |
| `lib/tokenStorage.ts` | `lib/tokenStorage.ts` | Token 存储 |
| `lib/httpClient.ts` | 无独立文件 | Vue 版在 api.ts 中内联 |
| `lib/authStore.ts` | 无独立文件 | Vue 版在 composable 中管理 |
| `pages/ChatPage.tsx` | `views/ChatPage.vue` | 聊天页 |
| `components/ChatWorkspace.tsx` | `components/ChatWorkspace.vue` | 聊天工作区 |
| `pages/DocumentsLayout.tsx` | 无（路由内联） | Vue 版直接在路由中处理 |

---

## 开发启动

### React 版

```bash
cd frontend
pnpm install
pnpm dev    # http://localhost:5173
```

### Vue 版

```bash
cd front-vue
pnpm install
pnpm dev    # http://localhost:5173
```

两个前端不能同时占用 5173 端口，需修改 `vite.config.ts` 中的 `server.port`。

### E2E 测试

```bash
cd frontend
pnpm e2e:install    # 安装 Playwright 浏览器
pnpm e2e:test       # 运行测试
pnpm e2e:report     # 查看报告
```

---

## 与后端的交互

前端通过以下方式与 Spring Boot 后端通信：

1. **REST API** — 登录、注册、文档上传、管理操作
2. **SSE（Server-Sent Events）** — RAG 流式问答、文档上传进度
3. **Token 认证** — Access Token + Refresh Token，自动刷新

API 基础路径：后端 `http://localhost:8080`，前端通过 Vite proxy 或直接请求。
