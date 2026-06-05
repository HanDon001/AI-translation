package com.livetranslate.gateway.filter;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * 请求日志过滤器
 * 对应原 TypeScript 的 requestLogger.ts
 */
@Slf4j
@Component
public class RequestLogFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        long startTime = System.currentTimeMillis();
        String path = exchange.getRequest().getPath().value();
        String method = exchange.getRequest().getMethod().name();

        log.info("请求开始: {} {}", method, path);

        return chain.filter(exchange).then(Mono.fromRunnable(() -> {
            long duration = System.currentTimeMillis() - startTime;
            int statusCode = exchange.getResponse().getStatusCode() != null
                    ? exchange.getResponse().getStatusCode().value() : 0;
            log.info("请求结束: {} {} {} {}ms", method, path, statusCode, duration);
        }));
    }

    @Override
    public int getOrder() {
        return -1;
    }
}
