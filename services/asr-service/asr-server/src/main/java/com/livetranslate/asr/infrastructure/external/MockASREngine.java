package com.livetranslate.asr.infrastructure.external;

import com.livetranslate.asr.domain.model.RecognitionResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.function.Consumer;

/**
 * Mock ASR 引擎
 * 无 API Key 时使用模拟数据
 */
@Slf4j
@Service
@ConditionalOnProperty(name = "asr.engine", havingValue = "mock", matchIfMissing = true)
public class MockASREngine implements ASREngine {

    private static final String[] MOCK_SCRIPT = {
        "Good morning everyone",
        "thank you for joining today's session",
        "I'd like to share some insights",
        "about the future of AI",
        "The rapid development of large language models",
        "has changed everything",
        "We believe that real-time translation",
        "will break down language barriers",
        "Let me show you a demo",
        "of our latest capabilities"
    };

    private int windowId = 0;

    @Override
    public void sendAudio(byte[] pcmData, Consumer<RecognitionResult> callback) {
        int idx = windowId % MOCK_SCRIPT.length;
        boolean isFinal = (windowId + 1) % 4 == 0;

        RecognitionResult result = RecognitionResult.builder()
                .text(MOCK_SCRIPT[idx])
                .isFinal(isFinal)
                .confidence(0.95)
                .startMs(windowId * 400L)
                .endMs((windowId + 1) * 400L)
                .build();

        callback.accept(result);
        windowId++;

        log.debug("Mock ASR: text={}, isFinal={}", result.getText(), isFinal);
    }

    @Override
    public void close() {
        windowId = 0;
        log.info("Mock ASR 引擎已关闭");
    }
}
