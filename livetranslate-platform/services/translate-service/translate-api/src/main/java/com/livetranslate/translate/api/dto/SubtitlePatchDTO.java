package com.livetranslate.translate.api.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 字幕补丁 DTO
 * 对应原 TypeScript 的 SubtitlePatchPayload
 */
@Data
public class SubtitlePatchDTO implements Serializable {

    /**
     * 动作类型
     */
    private SubtitleAction action;

    /**
     * 目标时间范围 [startMs, endMs]
     */
    private int[] targetRange;

    /**
     * 新文本
     */
    private String newText;

    /**
     * 样式
     */
    private SubtitleStyle style;

    public enum SubtitleAction {
        ADD_TEMP,
        MARK_FINAL,
        INVALIDATE
    }

    public enum SubtitleStyle {
        TEMP,
        FINAL
    }
}
