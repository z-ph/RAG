# front-vue

独立的 RAG 前端 Vue 子项目，采用 `Vue 3 + TypeScript + Vite`，功能与现有 `frontend/` 保持等价。

## 技术方案

- 使用 `Ant Design Vue + Tailwind CSS` 延续当前暖色、克制的控制台风格。
- 模型交互沿用原生 `fetch + POST SSE` 流解析，直接适配当前 Spring Boot 后端。
- 本地开发通过 Vite 代理把 `/api` 转发到 `http://localhost:8080`。

## 启动

```bash
cd front-vue
pnpm install
pnpm dev
```

默认访问地址：

- 前端 Vue 版：`http://localhost:5174`
- 后端：`http://localhost:8080`

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `VITE_BASE_ROUTE` | 前端基础路径 | `/rag` |
| `VITE_API_BASE_URL` | 后端 API 基础路径 | `/rag-back/api` |
| `VITE_BACKEND_URL` | Vite 开发代理目标地址 | `http://localhost:8080/rag-back/api` |

## 功能

- 用户登录 / 注册（注册码注册）
- 文档上传（支持多文件、文件夹批量上传）
- 文档列表查询、删除
- 文档下载链接（复制 / 下载）
- RAG 流式问答
- 图片问答（上传图片并提问）
- 文档检索与思考态读秒反馈
- 会话取消与清空
- 会话历史持久化（localStorage）
- 来源片段展示
- 消息复制
- 服务健康状态检查
- 管理后台（管理员）：用户管理、角色管理、权限管理、注册码管理、提示词管理、修改密码、文档片段管理
