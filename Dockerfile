# 使用轻量级的 Nginx 镜像
FROM nginx:alpine

# 删除默认配置
RUN rm /etc/nginx/conf.d/default.conf

# 拷贝你的自定义 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/

# ⚠️ 注意这里：将原来的 dist/ 改成了 out/
COPY out/ /usr/share/nginx/html/

# 暴露 80 端口（容器内）
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]