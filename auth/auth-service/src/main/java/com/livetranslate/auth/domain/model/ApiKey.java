package com.livetranslate.auth.domain.model;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * API Key 聚合根
 */
@Data
public class ApiKey {

    /** ID */
    private Long id;

    /** API Key */
    private String apiKey;

    /** 用户 ID */
    private Long userId;

    /** 描述 */
    private String description;

    /** 状态 */
    private KeyStatus status;

    /** 创建时间 */
    private LocalDateTime createdAt;

    /** 过期时间 */
    private LocalDateTime expireAt;

    /** 最后使用时间 */
    private LocalDateTime lastUsedAt;

    public enum KeyStatus {
        ACTIVE,
        DISABLED,
        EXPIRED
    }
}
