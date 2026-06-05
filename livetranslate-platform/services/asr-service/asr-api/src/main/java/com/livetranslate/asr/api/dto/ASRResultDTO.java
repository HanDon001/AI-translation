package com.livetranslate.asr.api.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * ASR 结果 DTO
 */
@Data
public class ASRResultDTO implements Serializable {

    /** 窗口 ID */
    private Integer windowId;

    /** 识别文本 */
    private String text;

    /** 是否为最终结果 */
    private Boolean isFinal;

    /** 开始时间（毫秒） */
    private Long startMs;

    /** 结束时间（毫秒） */
    private Long endMs;

    /** 语言 */
    private String language;
}
