package com.livetranslate.common.security.annotation;

import java.lang.annotation.*;

/**
 * API Key 必需注解
 * 对应原 TypeScript 的 if(!connState.apiKey) 逻辑
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface ApiKeyRequired {
}
