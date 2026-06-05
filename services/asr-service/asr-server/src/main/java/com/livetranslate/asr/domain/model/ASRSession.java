package com.livetranslate.asr.domain.model;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * ASR 会话聚合根
 * 对应原 TypeScript 的 connState
 */
@Data
public class ASRSession {

    /** 会话 ID */
    private String sessionId;

    /** API Key */
    private String apiKey;

    /** 源语言 */
    private String sourceLang;

    /** 目标语言 */
    private String targetLang;

    /** ASR 模型 */
    private String model;

    /** 采样率 */
    private Integer sampleRate;

    /** 会话状态 */
    private SessionStatus status;

    /** 创建时间 */
    private LocalDateTime createdAt;

    /** 最后活跃时间 */
    private LocalDateTime lastActiveAt;

    public enum SessionStatus {
        INITIALIZING,
        CONNECTING,
        READY,
        PROCESSING,
        CLOSED
    }
}
