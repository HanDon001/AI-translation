package com.livetranslate.asr.infrastructure.external;

import com.livetranslate.asr.domain.model.RecognitionResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.function.Consumer;

/**
 * Qwen ASR 引擎
 * 真实 DashScope WebSocket 实现
 */
@Slf4j
@Service
@ConditionalOnProperty(name = "asr.engine", havingValue = "qwen")
public class QwenASREngine implements ASREngine {

    @Value("${dashscope.api-key}")
    private String apiKey;

    @Value("${dashscope.ws-url}")
    private String wsUrl;

    @Override
    public void sendAudio(byte[] pcmData, Consumer<RecognitionResult> callback) {
        // TODO: 实现真实的 DashScope WebSocket 通信
        // 参考原 QwenASRService.ts 的实现
        log.info("Qwen ASR: 发送音频数据, size={}", pcmData.length);
    }

    @Override
    public void close() {
        log.info("Qwen ASR 引擎已关闭");
    }
}
