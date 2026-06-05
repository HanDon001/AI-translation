package com.livetranslate.asr.api.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 音频块 DTO
 * 对应原 TypeScript 的 AudioChunkEvent
 */
@Data
public class AudioChunkDTO implements Serializable {

    /** 窗口 ID */
    private Integer windowId;

    /** 开始时间（毫秒） */
    private Long startMs;

    /** 持续时间（毫秒） */
    private Integer duration;

    /** PCM 数据（Base64 编码） */
    private String pcmData;
}
