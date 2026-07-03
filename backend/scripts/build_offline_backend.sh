#!/bin/bash
# ==================== 配置 ====================
IMAGE_NAME="flask-fastapi-backend"
TAG="latest"
OUTPUT_TAR="backend_image.tar.gz"
DEPLOY_SH="deploy.sh"
# ==============================================

# 基础目录定位
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/deploy_package"

# 接收参数: build (默认) 或 test
MODE=${1:-"build"}

if [ "$MODE" == "test" ]; then
    echo "====== [本地调试模式] ======"
    echo "正在构建本地镜像..."
    docker build -t "${IMAGE_NAME}:test" -f "$PROJECT_ROOT/Dockerfile" "$PROJECT_ROOT"
    
    echo "正在启动调试容器..."
    # 【修改重点】：将引号内的路径明确为 Linux 容器内的路径
    docker run -it --rm \
        --name "${IMAGE_NAME}_test" \
        -v "$(cygpath -w "$PROJECT_ROOT"):/app" \
        -p 5000:5000 \
        "${IMAGE_NAME}:test" /bin/sh
    exit 0
fi

echo "====== [正式打包模式] 开始构建生产镜像 ======"
mkdir -p "$OUTPUT_DIR"

# 清理构建器并构建
docker buildx rm amdbuilder 2>/dev/null || true
docker buildx create --use --name amdbuilder 2>/dev/null || true
docker buildx build --platform linux/amd64 -t "${IMAGE_NAME}:${TAG}" -f "$PROJECT_ROOT/Dockerfile" "$PROJECT_ROOT" --load

if [ $? -ne 0 ]; then
    echo "❌ 构建失败！"
    exit 1
fi

echo "====== 压缩镜像 ======"
docker save "${IMAGE_NAME}:${TAG}" | gzip > "$OUTPUT_DIR/$OUTPUT_TAR"

echo "====== 收集环境与数据 ======"
[ -f "$PROJECT_ROOT/.env" ] && cp "$PROJECT_ROOT/.env" "$OUTPUT_DIR/"
[ -d "$PROJECT_ROOT/data" ] && cp -r "$PROJECT_ROOT/data" "$OUTPUT_DIR/" || mkdir -p "$OUTPUT_DIR/data"

echo "====== 生成部署脚本 ======"
cat << 'EOF' > "$OUTPUT_DIR/$DEPLOY_SH"
#!/bin/bash
IMAGE_NAME="flask-fastapi-backend"
TAG="latest"
TAR_FILE="backend_image.tar.gz"
CONTAINER_NAME="my-backend-app"

cd "$(dirname "$0")"

# 1. 清理
docker stop ${CONTAINER_NAME} 2>/dev/null && docker rm ${CONTAINER_NAME} 2>/dev/null
docker rmi ${IMAGE_NAME}:${TAG} 2>/dev/null

# 2. 加载
docker load -i ${TAR_FILE}

# 3. 运行
mkdir -p ./data
docker run -d \
    --name ${CONTAINER_NAME} \
    -p 5000:5000 \
    --restart always \
    --env-file .env \
    -v "$(pwd)/data:/app/data" \
    ${IMAGE_NAME}:${TAG}

echo "部署完成！日志预览:"
docker logs --tail 10 ${CONTAINER_NAME}
EOF

chmod +x "$OUTPUT_DIR/$DEPLOY_SH"
echo -e "\n🎉 打包完成！请拷贝 [ $OUTPUT_DIR ] 文件夹到内网。"
read -p "按回车键退出..."