package com.livetranslate.asr.application.service;

import com.livetranslate.asr.domain.model.ASRSession;
import com.livetranslate.asr.domain.model.RecognitionResult;
import com.livetranslate.asr.domain.service.QwenASRDomainService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.function.Consumer;

/**
 * ASR 应用服务
 * 编排：接收音频 → 调引擎 → 发事件
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ASRApplicationService {

    private final QwenASRDomainService qwenASRDomainService;

    /**
     * 创建 ASR 会话
     */
    public ASRSession createSession(String apiKey, String targetLang, String model) {
        return qwenASRDomainService.createSession(apiKey, targetLang, model);
    }

    /**
     * 处理音频数据
     */
    public void processAudio(ASRSession session, byte[] pcmData, Consumer<RecognitionResult> callback) {
        qwenASRDomainService.sendAudio(session, pcmData, callback);
    }

    /**
     * 关闭会话
     */
    public void closeSession(ASRSession session) {
        qwenASRDomainService.closeSession(session);
    }
}
