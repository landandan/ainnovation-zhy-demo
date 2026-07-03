#!/bin/bash
# ==================== 内网自动化部署脚本 ====================
IMAGE_NAME="flask-fastapi-backend"
TAG="latest"
# 【修改点 3】：部署脚本对接 .tar.gz
TAR_FILE="backend_image.tar.gz"
CONTAINER_NAME="my-backend-app"
PORT_MAPPING="5000:5000"

# 强行切换到脚本所在目录，确保相对路径正确
cd "$(dirname "$0")"

echo "====== [1/5] 检查前置条件 ======"
if [ ! -f ".env" ]; then
    echo "❌ 错误: 当前目录下找不到 .env 文件！"
    echo "请将项目里的 .env 文件拷贝到此目录下再运行。"
    exit 1
fi

echo "====== [2/5] 停止并清理旧容器 ======"
docker stop ${CONTAINER_NAME} 2>/dev/null && docker rm ${CONTAINER_NAME} 2>/dev/null
docker rmi ${IMAGE_NAME}:${TAG} 2>/dev/null

echo "====== [3/5] 载入新镜像 ======"
if [ ! -f "${TAR_FILE}" ]; then
    echo "❌ 错误: 未找到 ${TAR_FILE} 文件！"
    exit 1
fi
# docker load 原生支持加载 gzip 压缩包
docker load -i ${TAR_FILE}

echo "====== [4/5] 创建宿主机数据持久化目录 ======"
mkdir -p ./data

echo "====== [5/5] 启动新容器 ======"
docker run -d \
    --name ${CONTAINER_NAME} \
    -p ${PORT_MAPPING} \
    --restart always \
    --env-file .env \
    -v $(pwd)/data:/app/data \
    ${IMAGE_NAME}:${TAG}

echo "🎉 容器启动成功！查看启动日志确认初始化状态："
sleep 2
docker logs --tail 20 ${CONTAINER_NAME}
