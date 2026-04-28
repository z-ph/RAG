# frontend

独立的 RAG 前端子项目，采用 `React + TypeScript + Vite`。

## 技术方案

- UI 设计语言参考 `Ant Design X` 的企业级 AI 控制台风格。
- 模型交互采用原生 `fetch + POST SSE` 流解析，直接适配当前 Spring Boot 后端。
- 本地开发通过 Vite 代理把 `/api` 转发到 `http://localhost:8080`。
- **生产构建时前端需独立部署**，产物输出到 `dist/` 目录，由 Nginx 或任意静态服务器托管。

## 启动

### 本地开发

```bash
cd frontend
pnpm install
pnpm dev
```

默认访问地址：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:8080`

### 生产构建

```bash
cd frontend
pnpm build
```

产物输出到 `frontend/dist/` 目录，可用任意静态服务器部署。

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `VITE_API_BASE_URL` | 后端 API 基础路径 | `/api` |
| `VITE_PROXY_TARGET` | Vite 开发代理目标地址 | `http://localhost:8080` |

生产部署前，请在 `frontend/.env.production` 中设置实际的后端地址：

```dotenv
VITE_API_BASE_URL=http://your-backend-domain:8081/api
```

## 功能

- 文档上传、列表查询、删除
- RAG 流式问答
- 文档检索、思考内容折叠展示与自动收起
- 会话取消与清空
- 来源片段展示
- 消息复制
- 服务健康状态检查
