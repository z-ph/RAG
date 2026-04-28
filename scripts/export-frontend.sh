#!/bin/sh
set -eu

# 导出前端构建产物到宿主机 dist/ 目录
# 用法：./scripts/export-frontend.sh [镜像名]
# 默认镜像名：knowledge-rag

IMAGE="${1:-knowledge-rag}"
OUTPUT_DIR="${2:-dist}"

# 确保输出目录存在
mkdir -p "${OUTPUT_DIR}"

echo "Exporting frontend build from image '${IMAGE}' to ./${OUTPUT_DIR} ..."

docker run --rm \
  -v "$(pwd)/${OUTPUT_DIR}:/output/dist" \
  "${IMAGE}" \
  sh -c "mkdir -p /output/dist && cp -r /app/dist/* /output/dist/"

echo "Done. Frontend build output is available at ./${OUTPUT_DIR}/"
