package com.livetranslate.asr.domain.service;

import com.livetranslate.asr.domain.model.ASRSession;
import com.livetranslate.asr.domain.model.RecognitionResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.function.Consumer;

/**
 * Qwen ASR 领域服务
 * 对应原 TypeScript 的 QwenASRService.ts
 */
@Slf4j
@Service
public class QwenASRDomainService {

    /**
     * 创建 ASR 会话
     */
    public ASRSession createSession(String apiKey, String targetLang, String model) {
        ASRSession session = new ASRSession();
        session.setSessionId(java.util.UUID.randomUUID().toString());
        session.setApiKey(apiKey);
        session.setTargetLang(targetLang);
        session.setModel(model);
        session.setSampleRate(16000);
        session.setStatus(ASRSession.SessionStatus.INITIALIZING);
        session.setCreatedAt(java.time.LocalDateTime.now());
        session.setLastActiveAt(java.time.LocalDateTime.now());

        log.info("创建 ASR 会话: sessionId={}, model={}, targetLang={}",
                session.getSessionId(), model, targetLang);

        return session;
    }

    /**
     * 发送音频数据
     */
    public void sendAudio(ASRSession session, byte[] pcmData, Consumer<RecognitionResult> callback) {
        if (session.getStatus() != ASRSession.SessionStatus.READY) {
            log.warn("会话未就绪: sessionId={}, status={}", session.getSessionId(), session.getStatus());
            return;
        }

        session.setLastActiveAt(java.time.LocalDateTime.now());

        // TODO: 调用 DashScope WebSocket 发送音频
        // 这里是核心逻辑，需要实现与 DashScope 的 WebSocket 通信
        log.debug("发送音频数据: sessionId={}, size={}", session.getSessionId(), pcmData.length);
    }

    /**
     * 关闭会话
     */
    public void closeSession(ASRSession session) {
        session.setStatus(ASRSession.SessionStatus.CLOSED);
        log.info("关闭 ASR 会话: sessionId={}", session.getSessionId());
    }
}
