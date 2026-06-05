package com.livetranslate.asr.domain.model;

import lombok.Builder;
import lombok.Data;

/**
 * 识别结果值对象
 */
@Data
@Builder
public class RecognitionResult {

    /** 识别文本 */
    private String text;

    /** 是否为最终结果 */
    private boolean isFinal;

    /** 置信度 */
    private double confidence;

    /** 开始时间（毫秒） */
    private long startMs;

    /** 结束时间（毫秒） */
    private long endMs;
}
