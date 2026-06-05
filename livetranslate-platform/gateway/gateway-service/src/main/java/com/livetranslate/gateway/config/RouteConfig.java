package com.livetranslate.gateway.config;

import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 网关路由配置
 */
@Configuration
public class RouteConfig {

    @Bean
    public RouteLocator customRouteLocator(RouteLocatorBuilder builder) {
        return builder.routes()
                // ASR 服务路由
                .route("asr-service", r -> r
                        .path("/api/asr/**")
                        .filters(f -> f.stripPrefix(2))
                        .uri("lb://asr-service"))
                // 翻译服务路由
                .route("translate-service", r -> r
                        .path("/api/translate/**")
                        .filters(f -> f.stripPrefix(2))
                        .uri("lb://translate-service"))
                // 认证服务路由
                .route("auth-service", r -> r
                        .path("/api/auth/**")
                        .filters(f -> f.stripPrefix(2))
                        .uri("lb://auth-service"))
                .build();
    }
}
