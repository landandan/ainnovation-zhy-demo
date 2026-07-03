# Flask 后端 Dockerfile
FROM python:3.9-slim

WORKDIR /app

# 安装系统依赖
# 移除原有的 sed 命令，改为直接覆盖源文件，确保在任何 Debian 版本都能成功
RUN echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm main contrib non-free" > /etc/apt/sources.list && \
    echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian-security bookworm-security main contrib non-free" >> /etc/apt/sources.list && \
    echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm-updates main contrib non-free" >> /etc/apt/sources.list && \
    apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制源码
COPY . .

# 3. 【新增】声明数据持久化目录
VOLUME ["/app/data"]

EXPOSE 5000

# 5. 生产环境用 gunicorn (作为参数传递给 ENTRYPOINT)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "app:create_app()"]
