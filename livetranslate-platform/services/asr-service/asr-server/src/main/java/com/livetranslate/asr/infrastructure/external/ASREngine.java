package com.livetranslate.asr.infrastructure.external;

import com.livetranslate.asr.domain.model.RecognitionResult;

import java.util.function.Consumer;

/**
 * ASR 引擎接口
 * 策略模式：Mock 或 Qwen
 */
public interface ASREngine {

    /**
     * 发送音频数据进行识别
     */
    void sendAudio(byte[] pcmData, Consumer<RecognitionResult> callback);

    /**
     * 关闭引擎
     */
    void close();
}
