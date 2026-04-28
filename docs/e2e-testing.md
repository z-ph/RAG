# 前端 E2E 测试指南

前端 E2E 测试基于 [Playwright](https://playwright.dev/)，覆盖智能问答、文档集合、用户认证、管理后台四大功能模块的完整交互链路。

---

## 架构概览

```
frontend/
├── e2e/
│   ├── fixtures.ts          # 扩展测试上下文（匿名/管理员/成员 page）
│   ├── pages/
│   │   ├── chat.page.ts     # 主聊天页面 PO
│   │   ├── documents.page.ts# 文档集合抽屉 PO
│   │   ├── auth.page.ts     # 用户认证抽屉 PO
│   │   └── admin.page.ts    # 管理后台抽屉 PO
│   ├── tests/
│   │   ├── auth.spec.ts     # 认证交互（6 例）
│   │   ├── chat.spec.ts     # 问答交互（6 例）
│   │   ├── documents.spec.ts# 文档交互（5 例）
│   │   └── admin.spec.ts    # 管理后台交互（6 例）
│   ├── utils/
│   │   └── api.ts           # 后端 API 直接调用（数据准备/清理）
│   └── tsconfig.json        # E2E 专用 TypeScript 配置
├── playwright.config.ts     # Playwright 主配置
└── package.json             # 新增 e2e 脚本
```

---

## 容器环境

E2E 测试要求**真实的全栈容器环境**，包括 MySQL、Qdrant、后端和前端的完整服务栈。

### 专用容器编排

| 文件 | 说明 |
|------|------|
| `docker-compose.e2e.yml` | E2E 专用编排，使用独立端口避免与开发环境冲突 |
| `.env.e2e` | 环境变量副本，默认使用 Ollama 本地模型 |

**端口映射（与开发环境隔离）：**

| 服务 | E2E 端口 | 开发端口 |
|------|---------|---------|
| MySQL | 3307 | 3306 |
| Qdrant HTTP | 6335 | 6333 |
| Qdrant gRPC | 6336 | 6334 |
| 后端 | 8082 | 8080 / 8081 |
| 前端 | 5174 | 5173 |

---

## 快速开始

### 1. 安装依赖

```bash
cd frontend
pnpm install
pnpm exec playwright install --with-deps chromium
```

或一键执行：

```bash
# Linux / macOS / Git Bash
./scripts/e2e.sh install

# Windows PowerShell
.\scripts\e2e.ps1 install
```

### 2. 启动测试环境

```bash
# Linux / macOS / Git Bash
./scripts/e2e.sh start

# Windows PowerShell
.\scripts\e2e.ps1 start
```

该命令会：
1. 构建并启动 `mysql-e2e`、`qdrant-e2e`、`backend-e2e`、`frontend-e2e`
2. 轮询后端健康检查直到就绪
3. 输出前端和后端访问地址

### 3. 运行测试

```bash
# 运行全部测试（自动检测容器状态，未启动则自动启动）
./scripts/e2e.sh test

# UI 模式（带浏览器界面，方便调试）
./scripts/e2e.sh test:ui

# 仅运行指定测试文件
./scripts/e2e.sh test -- e2e/tests/auth.spec.ts

# Windows 对应命令
.\scripts\e2e.ps1 test
.\scripts\e2e.ps1 test:ui
```

### 4. 查看报告

```bash
./scripts/e2e.sh report
# 或
.\scripts\e2e.ps1 report
```

### 5. 停止环境

```bash
./scripts/e2e.sh stop
# 或
.\scripts\e2e.ps1 stop
```

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PLAYWRIGHT_BASE_URL` | `http://localhost:5174` | 前端地址 |
| `PLAYWRIGHT_API_URL` | `http://localhost:8082` | 后端 API 地址 |
| `PLAYWRIGHT_ADMIN_USER` | `admin` | 测试管理员用户名 |
| `PLAYWRIGHT_ADMIN_PASSWORD` | `ChangeMe123!` | 测试管理员密码 |

可在运行脚本前设置以覆盖默认值：

```bash
export PLAYWRIGHT_ADMIN_PASSWORD=MySecret
./scripts/e2e.sh test
```

---

## 测试用例覆盖

### 认证交互（auth.spec.ts）

- 匿名访客首页显示登录按钮
- 管理员登录流程（UI 输入 → session 建立）
- 登录后登出流程
- 注册码注册流程（API 生成注册码 → UI 注册 → 验证登录状态）
- 管理员可看到管理按钮
- 普通成员看不到管理按钮

### 智能问答交互（chat.spec.ts）

- 匿名访客发送文本问题，AI 流式回答（验证气泡出现 + 流式完成）
- 已登录用户发送文本问题
- 清空对话（验证消息列表清空）
- 展开来源片段（验证详情可见）
- 复制回答按钮（验证文案切换为"已复制"）
- 图片问答（Base64 图片上传 + 提问）

### 文档集合交互（documents.spec.ts）

- 匿名访客可查看公开文档列表
- 匿名访客可查看文档详情
- 管理员上传文档（通过 hidden input 模拟文件上传）
- 管理员删除文档
- 已登录成员可查看完整文档列表

### 管理后台交互（admin.spec.ts）

- 管理员可访问提示词管理
- 管理员编辑并保存提示词
- 管理员重置提示词
- 管理员生成注册码
- 管理员禁用注册码
- 管理员删除注册码

---

## 设计要点

### 数据准备与清理

- 通过 `e2e/utils/api.ts` 直接调用后端 REST API 准备/清理测试数据，绕过前端 UI 以提升速度和稳定性。
- 上传的测试文档、创建的注册码均在 `finally` 块中清理，即使测试失败也不会残留数据。

### Fixtures

- `anonymousPage`：未登录状态的全新 page
- `adminPage`：已通过 API 登录管理员的 page（session cookie 自动注入）
- `memberPage`：已登录成员的 page

### 不确定性的处理

LLM 回答内容不可预测，因此测试只验证：
- AI 消息气泡是否正确出现
- 流式光标是否最终消失
- 按钮交互状态是否变化
- 不验证回答的具体文本内容

### 并发策略

- `workers: 1`：串行执行，避免容器资源竞争
- `retries: 2`（CI）/ `1`（本地）：E2E 测试天然 flaky，适度重试

---

## CI/CD 集成建议

```yaml
# GitHub Actions 示例片段
- name: Start E2E services
  run: ./scripts/e2e.sh start

- name: Run Playwright tests
  run: ./scripts/e2e.sh test

- name: Upload report
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: frontend/playwright-report/

- name: Stop E2E services
  if: always()
  run: ./scripts/e2e.sh stop
```

---

## 常见问题

**Q: 容器启动后后端健康检查一直失败？**
A: 首次构建 Docker 镜像耗时较长，请耐心等待。如超过 2 分钟仍未就绪，检查 `docker compose -f docker-compose.e2e.yml logs backend-e2e` 查看报错。

**Q: LLM 不可用导致问答测试失败？**
A: E2E 环境默认使用 `.env.e2e` 中的 Ollama 配置。确保宿主机已运行 Ollama 且模型已下载，或修改为可用的 vLLM 地址。

**Q: 测试在本地通过但在 CI 失败？**
A: 检查 CI 环境的 Docker 资源限制（内存/CPU）。Playwright 的 `trace` 和 `video` 会在首次重试失败时自动录制，通过报告可定位问题。
