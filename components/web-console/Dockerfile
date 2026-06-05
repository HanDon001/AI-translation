# Web 控制台 Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package.json package-lock.json* ./
RUN npm install --registry https://registry.npmmirror.com

# 复制代码
COPY . .

# 构建
RUN npm run build

# 生产阶段
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
