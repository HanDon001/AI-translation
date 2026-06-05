package com.livetranslate.translate.domain.model;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 翻译任务聚合根
 */
@Data
public class TranslateTask {

    /** 任务 ID */
    private String taskId;

    /** 会话 ID */
    private String sessionId;

    /** 源语言 */
    private String sourceLang;

    /** 目标语言 */
    private String targetLang;

    /** 源文本 */
    private String sourceText;

    /** 翻译结果 */
    private String translatedText;

    /** 任务状态 */
    private TaskStatus status;

    /** 创建时间 */
    private LocalDateTime createdAt;

    /** 完成时间 */
    private LocalDateTime completedAt;

    public enum TaskStatus {
        PENDING,
        TRANSLATING,
        COMPLETED,
        FAILED
    }
}
