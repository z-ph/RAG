# SSE Chunking 问题：Docker 容器网络根因调查与实验设计 v2

> 状态：研究报告已完成，实验脚本已就绪，待部署验证
> 日期：2026-04-29
> 前置文档：[sse-chunking-retrospective.md](./sse-chunking-retrospective.md)
> **重要更新**：本次调查重点增加了 Docker **INBOUND** 路径（vLLM → 容器）和**宿主机对照实验**的排查。

---

## 一、修正后的核心结论

**数秒级间隔只符合一个特征：buffer 满才 flush。Nagle 的 200ms 不可能造成数秒停顿。**

之前分析遗漏了最关键的一条链路：

```
vLLM (宿主机外部)
  → [Docker INBOUND: bridge/NAT/veth] → Java 容器
    → Tomcat OutputBuffer (8192 bytes)
      → [Docker OUTBOUND: bridge/NAT/veth]
        → Nginx → Client
```

**我们之前的排查只覆盖了 Java → Client 这段，完全漏了 vLLM → Java 这段。**

vLLM 响应从宿主机外部进入 Docker 容器时，同样经过 docker0 bridge、iptables DNAT、veth 对。如果这段 **INBOUND** 路径把 vLLM 的逐 token SSE 流 chunking 了，Java 应用收到的就是已经成块的数据——`flushBuffer()` 再好也只是 flush 块，不是 flush 单 token。

**金标准验证方法**：在宿主机直接 `./mvnw spring-boot:run`，外网直接 curl `:8080`。如果正常 → Docker 是根因；如果也 chunking → Java 代码层问题。

---

## 二、完整的链路分析与嫌疑层级

### 2.1 链路全景图

```
┌──────────────────────────────────────────────────────────────────────┐
│  宿主机 (Host)                                                        │
│  ┌──────────────┐     ┌─────────────┐     ┌──────────────┐          │
│  │ vLLM 服务    │────→│ docker0     │────→│ Java 容器    │          │
│  │ :8000/:443   │     │ bridge/NAT  │     │ :8080        │          │
│  └──────────────┘     └─────────────┘     └──────┬───────┘          │
│        ↑ Docker INBOUND                         │ Docker OUTBOUND   │
│        (veth/iptables/conntrack)                │ (veth/NAT)        │
│                                                  ↓                   │
│                                        ┌──────────────┐             │
│                                        │ 宿主机 :8081  │             │
│                                        │ (端口映射)    │             │
│                                        └──────┬───────┘             │
│                                               ↓                      │
│                                        ┌──────────────┐             │
│                                        │ Nginx :80    │             │
│                                        └──────┬───────┘             │
│                                               ↓                      │
│                                        ┌──────────────┐             │
│                                        │ Client       │             │
│                                        └──────────────┘             │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 每一层的嫌疑分析

| 层级 | 嫌疑 | 原因 | 已有排查 |
|------|------|------|---------|
| **vLLM 本身** | 低 | 宿主机直接 curl vLLM，逐 token | ✅ retrospective 已验证 |
| **Docker INBOUND** (vLLM→容器) | **高** | vLLM 在宿主机，Java 在容器，数据必须过 bridge/NAT | ❌ **从未验证** |
| **Tomcat OutputBuffer** | 中 | 默认 8192 bytes，flushBuffer() 已提交但未确认生效 | 待验证 |
| **LangChain4j HTTP 客户端** | 中 | HTTP 客户端可能有响应缓冲 | ❌ 从未检查 |
| **Docker OUTBOUND** (容器→客户端) | 中 | 同 inbound，NAT 对小包不友好 | 待验证 |
| **Nginx** | 低 | `X-Accel-Buffering: no` 已设置 | 待验证 |

---

## 三、实验设计（四层隔离 + 金标准对照）

### 3.1 四层隔离实验

| 实验 | 操作 | 覆盖的链路 | 判定 |
|------|------|-----------|------|
| **A** | 容器内 `curl vLLM` | vLLM → Docker INBOUND → 容器内 | 如果 chunking → Docker inbound 有问题 |
| **B** | 容器内 `curl localhost:8080` | Java 内部（排除所有 Docker） | 如果 chunking → Tomcat flush 没生效 |
| **C** | 宿主机 `curl :8081` | Java → Docker OUTBOUND | 如果 chunking → Docker outbound 有问题 |
| **D** | 宿主机 `curl Nginx:80` | 完整链路 | 如果 chunking → Nginx 有问题 |

### 3.2 判定矩阵

```
实验 A (vLLM inbound)     实验 B (Tomcat 内部)
        ↓                          ↓
    异常 / 正常               异常 / 正常
        ↓                          ↓
┌──────────────────────────────────────────────────┐
│ A 异常 → Docker INBOUND 是根因（vLLM 响应被缓冲）│
│ A 正常+B 异常 → Java/Tomcat 是根因               │
│ A-B 正常+C 异常 → Docker OUTBOUND 是根因         │
│ A-C 正常+D 异常 → Nginx 是根因                   │
│ 全部正常 → 已修复                                │
└──────────────────────────────────────────────────┘
```

### 3.3 金标准对照实验（必须手动执行）

这是**唯一能 100% 判定根因在 Docker 还是在 Java 代码**的实验：

```bash
# 步骤 1：停止 Docker 容器，释放端口
docker compose down

# 步骤 2：在宿主机直接启动 Spring Boot
./mvnw spring-boot:run

# 步骤 3：从另一台机器（或本机另一个终端）直接 curl 宿主机 :8080
curl -sS -N http://<宿主机IP>:8080/rag/ask/stream \
  -H 'Content-Type: application/json' \
  -d '{"question":"后端学习路线"}' \
  | perl -MTime::HiRes=time -MPOSIX=strftime -ne '...'
```

| 结果 | 结论 |
|------|------|
| **宿主机 Java 直接运行正常**（逐 token） | → **100% 确认 Docker 是根因**（inbound 或 outbound） |
| **宿主机 Java 直接运行也 chunking** | → **100% 确认 Java 代码层有问题**（flushBuffer 没走通，或 LangChain4j 客户端缓冲） |

> 为什么这是金标准？同一套代码、同一个 JVM、同一个 Tomcat，唯一变量是 Docker。排除了 Docker 后，如果问题还在，只能是代码层。

---

## 四、已交付的实验脚本

### 4.1 `scripts/sse-docker-isolation-test.sh`

自动执行实验 A/B/C/D，输出判定结论：

```bash
chmod +x scripts/sse-docker-isolation-test.sh
./scripts/sse-docker-isolation-test.sh "后端学习路线"
```

脚本会自动检测：
- 容器是否运行
- 容器内是否有 curl（自动尝试安装）
- 四层实验的 chunking 程度
- 输出判定矩阵和修复建议

### 4.2 `scripts/sse-network-diag.sh`

网络层深度诊断（需要 sudo）：

```bash
chmod +x scripts/sse-network-diag.sh
./scripts/sse-network-diag.sh
```

检查项：
- 容器内 `tcp_wmem/tcp_rmem`
- TCP_NODELAY 状态（需要活跃 SSE 连接时执行）
- Docker 网络配置（MTU、bridge）
- iptables NAT 规则
- conntrack 统计
- Docker userland-proxy 状态

### 4.3 `scripts/test-sse-timestamp.sh`

现有脚本，用于给 SSE 事件打毫秒时间戳：

```bash
./scripts/test-sse-timestamp.sh "后端学习路线"
```

---

## 五、如果 Docker INBOUND 是根因（实验 A 异常）

### 5.1 为什么 Docker inbound 会 chunking？

vLLM 在宿主机上运行（或外部服务器），Java 容器通过 `host.docker.internal` 或外部 IP 访问 vLLM。数据路径：

```
vLLM socket write (宿主机)
  → 宿主机 eth0
  → iptables DNAT (Docker 创建的规则)
  → docker0 bridge
  → veth pair
  → 容器 eth0
  → Java socket read
```

这段路径和 outbound 完全对称。每一层都可能引入缓冲：

- **veth/bridge GRO**：Generic Receive Offload 可能合并小 TCP segment
- **iptables conntrack**：入站 NAT 跟踪增加每包处理时间
- **容器内 TCP 接收缓冲**：`tcp_rmem` default 可能过大，内核等待更多数据再交给应用

### 5.2 修复方案

**方案 1：host 网络模式（测试用）**

```yaml
services:
  app:
    # ...
    network_mode: "host"   # 完全绕过 Docker bridge/NAT
    # 不需要 ports 映射
```

**方案 2：macvlan（生产可用）**

让容器获得独立的宿主机网段 IP，绕过 NAT：

```bash
docker network create -d macvlan \
  --subnet=192.168.1.0/24 \
  --gateway=192.168.1.1 \
  -o parent=eth0 \
  macnet

# docker-compose.yml
services:
  app:
    networks:
      - macnet
    # 不需要 ports

networks:
  macnet:
    external: true
```

**方案 3：sysctls 调优**

```yaml
services:
  app:
    sysctls:
      - net.ipv4.tcp_rmem=4096 4096 16777216   # 降低接收缓冲 default
      - net.ipv4.tcp_wmem=4096 4096 16777216   # 降低发送缓冲 default
      - net.ipv4.tcp_low_latency=1              # 优先低延迟而非吞吐
```

---

## 六、如果 Java 代码层是根因（实验 B 异常，或金标准对照异常）

### 6.1 排查清单

1. **确认 `flushBuffer()` 被调用**
   - 在 `RagService.java` 的 `sendEvent()` 方法中打断点
   - 确认 `generation.flush()` 确实执行了

2. **确认 `flushBuffer()` 能穿透到 socket**
   - 检查是否有 Servlet Filter 包装了 response
   - 特别是 `ShallowEtagHeaderFilter`、`ContentCachingResponseWrapper` 等会缓冲响应的 Filter

3. **检查 LangChain4j HTTP 客户端**
   - LangChain4j 内部使用 `OkHttp` 或 `Java HttpClient` 访问 vLLM
   - 检查是否有响应缓冲配置
   - 确认 vLLM 的 SSE 流是否被客户端逐行读取，而不是整块读取

4. **检查 Spring 版本**
   - Spring Framework < 6.0.12 时，`SseEmitter.send(SseEventBuilder)` 的 flush 行为不同
   - 查看 `pom.xml` 中的 Spring Boot 版本

### 6.2 Tomcat Nagle 修复（即使不是主因，也建议做）

```java
@Configuration
public class TomcatStreamingConfig {
    @Bean
    public TomcatConnectorCustomizer sseStreamingCustomizer() {
        return connector -> {
            if (connector.getProtocolHandler() instanceof AbstractHttp11Protocol<?> protocol) {
                protocol.setTcpNoDelay(true);
            }
        };
    }
}
```

---

## 七、参考来源

### Spring / Tomcat 源码
- [SseEmitter.java](https://github.com/spring-projects/spring-framework/blob/main/spring-webmvc/src/main/java/org/springframework/web/servlet/mvc/method/annotation/SseEmitter.java)
- [ResponseBodyEmitterReturnValueHandler.java](https://github.com/spring-projects/spring-framework/blob/main/spring-webmvc/src/main/java/org/springframework/web/servlet/mvc/method/annotation/ResponseBodyEmitterReturnValueHandler.java)
- [Tomcat OutputBuffer.java](https://github.com/apache/tomcat/blob/main/java/org/apache/catalina/connector/OutputBuffer.java)

### GitHub Issues
- [spring-projects/spring-framework #19864](https://github.com/spring-projects/spring-framework/issues/19864)
- [spring-projects/spring-framework #30912](https://github.com/spring-projects/spring-framework/issues/30912)
- [spring-projects/spring-framework #32866](https://github.com/spring-projects/spring-framework/issues/32866)
- [moby/moby #7857](https://github.com/moby/moby/issues/7857)

### 技术文章
- [Marc Brooker: Nagle's Algorithm](https://brooker.co.za/blog/2024/05/09/nagle.html)
- [Falcon: EuroSys'21](https://ranger.uta.edu/~jrao/papers/EuroSys21.pdf)
- [ONCache: arXiv 2305.05455](https://arxiv.org/html/2305.05455v3)

---

## 八、文件清单

| 文件 | 说明 |
|------|------|
| `scripts/sse-docker-isolation-test.sh` | 四层隔离实验 + 判定矩阵（v2 更新） |
| `scripts/sse-network-diag.sh` | 网络层诊断脚本 |
| `scripts/test-sse-timestamp.sh` | 现有 SSE 时间戳测试 |
| `docs/sse-chunking-retrospective.md` | 原始复盘文档 |
| `docs/sse-docker-network-investigation.md` | 本报告（v2） |

---

*部署修复后，先跑 `./scripts/sse-docker-isolation-test.sh`，再做金标准对照实验（宿主机 `./mvnw spring-boot:run`），即可 100% 判定根因。*
