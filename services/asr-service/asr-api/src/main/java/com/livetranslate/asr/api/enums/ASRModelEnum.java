package com.livetranslate.asr.api.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * ASR 模型枚举
 */
@Getter
@AllArgsConstructor
public enum ASRModelEnum {

    QWEN3_ASR_FLASH("qwen3-asr-flash-realtime", "Qwen3 ASR Flash"),
    QWEN3_TRANSLATE_FLASH("qwen3.5-livetranslate-flash-realtime", "Qwen3.5 LiveTranslate Flash");

    private final String code;
    private final String description;
}
