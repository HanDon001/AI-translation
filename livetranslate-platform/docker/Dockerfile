# Java 服务 Dockerfile
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# 复制 JAR 文件
COPY target/*.jar app.jar

# 暴露端口
EXPOSE 8080

# 启动应用
ENTRYPOINT ["java", "-jar", "app.jar"]
