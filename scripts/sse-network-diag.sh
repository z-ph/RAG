#!/usr/bin/env bash
# SSE 网络层诊断脚本
# ============================================================
# 用途：诊断 Docker 容器网络的 TCP 缓冲和 Nagle 算法状态
# 用法：在宿主机上运行 (需要 docker 权限)
# ============================================================

set -euo pipefail

CONTAINER_NAME="${APP_CONTAINER:-rag-app-1}"
CONTAINER_PORT="${APP_CONTAINER_PORT:-8080}"
DOCKER_PORT="${APP_DOCKER_PORT:-8081}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERR]${NC}   $*"; }

header() {
  echo ""
  echo "========================================"
  echo "  $1"
  echo "========================================"
}

# -----------------------------------------------------------
# 检查 1：容器内 TCP 缓冲区大小
# -----------------------------------------------------------
header "检查 1：容器内 TCP 缓冲区大小 (tcp_wmem / tcp_rmem)"

if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  ok "容器 $CONTAINER_NAME 运行中"
else
  err "容器 $CONTAINER_NAME 未运行"
  exit 1
fi

echo ""
echo "--- 容器内 tcp_wmem (发送缓冲区) ---"
docker exec "$CONTAINER_NAME" sysctl net.ipv4.tcp_wmem 2>/dev/null || warn "无法读取 tcp_wmem"

echo ""
echo "--- 容器内 tcp_rmem (接收缓冲区) ---"
docker exec "$CONTAINER_NAME" sysctl net.ipv4.tcp_rmem 2>/dev/null || warn "无法读取 tcp_rmem"

echo ""
echo "--- 宿主机 tcp_wmem (对比) ---"
sysctl net.ipv4.tcp_wmem 2>/dev/null || warn "无法读取宿主机 tcp_wmem"

echo ""
echo "📋 解读:"
echo "  格式: min default max (字节)"
echo "  default 值越大，内核越容易缓存小包"
echo "  SSE 场景建议调低 default (如 4096)"
echo ""

# -----------------------------------------------------------
# 检查 2：宿主机与容器的 sysctl 差异
# -----------------------------------------------------------
header "检查 2：关键网络参数对比"

PARAMS=(
  "net.ipv4.tcp_notsent_lowat"
  "net.ipv4.tcp_slow_start_after_idle"
  "net.ipv4.tcp_congestion_control"
  "net.ipv4.tcp_mtu_probing"
  "net.core.netdev_max_backlog"
)

echo ""
printf "%-45s %-20s %-20s\n" "参数" "宿主机" "容器内"
printf "%-45s %-20s %-20s\n" "---------------------------------------------" "--------------------" "--------------------"

for param in "${PARAMS[@]}"; do
  host_val=$(sysctl -n "$param" 2>/dev/null || echo "N/A")
  container_val=$(docker exec "$CONTAINER_NAME" sysctl -n "$param" 2>/dev/null || echo "N/A")
  printf "%-45s %-20s %-20s\n" "$param" "$host_val" "$container_val"
done

echo ""

# -----------------------------------------------------------
# 检查 3：TCP_NODELAY 状态（需要正在进行的 SSE 连接）
# -----------------------------------------------------------
header "检查 3：Tomcat 连接的 TCP_NODELAY 状态"

echo ""
echo "--- 容器内已建立的连接 ---"
echo "  (需要正在有 SSE 请求时执行才能看到结果)"
echo ""

# 在容器内检查 sport = 8080 的连接
docker exec "$CONTAINER_NAME" sh -c "
  if command -v ss >/dev/null 2>&1; then
    ss -tinm state established '( sport = $CONTAINER_PORT )' 2>/dev/null || echo '无匹配连接'
  else
    echo 'ss 命令不可用'
  fi
" | while read -r line; do
  if echo "$line" | grep -q "nodelay"; then
    ok "  $line"
  elif echo "$line" | grep -qE "tcp\s+ESTAB"; then
    warn "  $line"
  else
    echo "  $line"
  fi
done

echo ""
echo "📋 解读:"
echo "  查找 'nodelay' 标志:"
echo "    ✅ 存在 nodelay → Nagle 算法已禁用（小包立即发送）"
echo "    ❌ 不存在 nodelay → Nagle 算法生效（小包会被缓存 200ms）"
echo ""
echo "  注意: 如果上面没有输出，说明当前没有活跃的 SSE 连接。"
echo "        请在另一个终端发起 SSE 请求时重新运行此脚本。"
echo ""

# -----------------------------------------------------------
# 检查 4：宿主机侧的 Docker NAT 连接
# -----------------------------------------------------------
header "检查 4：宿主机侧连接状态"

echo ""
echo "--- 宿主机上 dport = $DOCKER_PORT 的连接 ---"
if command -v ss >/dev/null 2>&1; then
  ss -tinm state established "( dport = :$DOCKER_PORT )" 2>/dev/null || echo "无匹配连接"
else
  warn "宿主机没有 ss 命令"
fi

echo ""

# -----------------------------------------------------------
# 检查 5：Docker 网络配置
# -----------------------------------------------------------
header "检查 5：Docker 网络配置"

echo ""
echo "--- 容器网络详情 ---"
docker inspect "$CONTAINER_NAME" --format '
  网络模式: {{.HostConfig.NetworkMode}}
  IP 地址:  {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}
  网关:     {{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}
  MTU:      {{range .NetworkSettings.Networks}}{{$v := index . "DriverOpts"}}{{if $v}}{{$v}}{{else}}默认{{end}}{{end}}
' 2>/dev/null || warn "无法 inspect 容器"

echo ""
echo "--- Docker bridge 网络详情 ---"
docker network inspect bridge --format '
  子网: {{range .IPAM.Config}}{{.Subnet}}{{end}}
  网关: {{range .IPAM.Config}}{{.Gateway}}{{end}}
  MTU:  {{index .Options "com.docker.network.driver.mtu"}}
' 2>/dev/null || warn "无法 inspect bridge 网络"

echo ""

# -----------------------------------------------------------
# 检查 6：iptables NAT 规则
# -----------------------------------------------------------
header "检查 6：iptables NAT 规则 (需要 sudo)"

echo ""
if sudo -n true 2>/dev/null; then
  echo "--- DNAT 规则 (端口映射) ---"
  sudo iptables -t nat -L DOCKER -n --line-numbers 2>/dev/null | grep ":$DOCKER_PORT" || echo "未找到 $DOCKER_PORT 的 DNAT 规则"

  echo ""
  echo "--- FORWARD 规则 ---"
  sudo iptables -L DOCKER -n --line-numbers 2>/dev/null | head -20 || echo "无法读取 FORWARD 规则"

  echo ""
  echo "--- conntrack 统计 ---"
  sudo conntrack -S 2>/dev/null || echo "conntrack 不可用"
else
  warn "需要 sudo 权限查看 iptables，跳过"
  echo "  手动运行: sudo iptables -t nat -L DOCKER -n"
fi

echo ""

# -----------------------------------------------------------
# 检查 7：Docker userland-proxy 状态
# -----------------------------------------------------------
header "检查 7：Docker 用户空间代理"

echo ""
echo "--- Docker daemon 配置 ---"
if [[ -f /etc/docker/daemon.json ]]; then
  echo "daemon.json 内容:"
  cat /etc/docker/daemon.json 2>/dev/null || true
else
  echo "未找到 /etc/docker/daemon.json"
fi

echo ""
echo "--- userland-proxy 状态 ---"
docker system info 2>/dev/null | grep -i "userland" || echo "无法获取 (userland-proxy 默认开启)"

echo ""
echo "📋 解读:"
echo "  userland-proxy=true (默认) → Docker 使用用户态进程转发端口"
echo "                               增加额外开销，小包场景影响明显"
echo "  userland-proxy=false       → 使用 iptables 直接转发，性能更好"
echo ""

# -----------------------------------------------------------
# 检查 8：tcpdump 快速验证（可选）
# -----------------------------------------------------------
header "检查 8：tcpdump 抓包验证 (可选)"

echo ""
echo "📋 如需抓包分析，在另一个终端运行以下命令之一:"
echo ""
echo "  # 在容器内抓包（Tomcat 发出的小包）"
echo "  docker exec $CONTAINER_NAME tcpdump -i eth0 -n -ttt 'tcp port $CONTAINER_PORT'"
echo ""
echo "  # 在 docker0 网桥抓包（经过 NAT 后的包）"
echo "  sudo tcpdump -i docker0 -n -ttt 'tcp port $CONTAINER_PORT'"
echo ""
echo "  # 在宿主机外部接口抓包（发给客户端的包）"
echo "  sudo tcpdump -i \$(ip route | grep default | awk '{print \$5}') -n -ttt 'tcp port $DOCKER_PORT'"
echo ""
echo "  观察重点: 同一毫秒内是否有多个 data: 行被一起发出"
echo ""

# -----------------------------------------------------------
# 汇总
# -----------------------------------------------------------
header "诊断汇总"

echo ""
echo "🔍 如果实验 1 (容器内) 正常但实验 2 (Docker NAT) 异常，重点检查:"
echo "   1. userland-proxy (建议设为 false)"
echo "   2. tcp_wmem default 值是否过大 (建议 4096)"
echo "   3. veth/iptables/conntrack 瓶颈"
echo ""
echo "🔍 如果实验 1 就异常，重点检查:"
echo "   1. Tomcat flushBuffer() 是否生效"
echo "   2. TCP_NODELAY 是否启用 (Tomcat socket.tcpNoDelay)"
echo "   3. Spring 版本 (< 6.0.12 有单独 flush 问题)"
echo ""
echo "📄 完整实验脚本: ./sse-docker-isolation-test.sh"
echo ""
