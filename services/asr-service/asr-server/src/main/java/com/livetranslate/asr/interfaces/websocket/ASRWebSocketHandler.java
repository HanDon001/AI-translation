package com.livetranslate.asr.interfaces.websocket;

import com.alibaba.fastjson2.JSON;
import com.livetranslate.asr.application.service.ASRApplicationService;
import com.livetranslate.asr.domain.model.ASRSession;
import com.livetranslate.asr.domain.model.RecognitionResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * ASR WebSocket 处理器
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ASRWebSocketHandler extends TextWebSocketHandler {

    private final ASRApplicationService asrApplicationService;
    private final Map<String, ASRSession> asrSessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        log.info("ASR WebSocket 连接已建立: sessionId={}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();

        try {
            Map<String, Object> msg = JSON.parseObject(payload, Map.class);
            String type = (String) msg.get("type");

            if ("set_api_key".equals(type)) {
                handleApiKey(session, msg);
            } else if ("audio_chunk".equals(type)) {
                handleAudioChunk(session, msg);
            } else if ("config".equals(type)) {
                handleConfig(session, msg);
            }
        } catch (Exception e) {
            log.error("处理消息失败: sessionId={}", session.getId(), e);
            sendError(session, "消息处理失败: " + e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        ASRSession asrSession = asrSessions.remove(session.getId());
        if (asrSession != null) {
            asrApplicationService.closeSession(asrSession);
        }
        log.info("ASR WebSocket 连接已关闭: sessionId={}", session.getId());
    }

    private void handleApiKey(WebSocketSession session, Map<String, Object> msg) {
        Map<String, Object> payload = (Map<String, Object>) msg.get("payload");
        String apiKey = (String) payload.get("apiKey");

        ASRSession asrSession = asrApplicationService.createSession(apiKey, "zh", "qwen3.5-livetranslate-flash-realtime");
        asrSessions.put(session.getId(), asrSession);

        log.info("API Key 已设置: sessionId={}", session.getId());
        sendMessage(session, Map.of("type", "auth_success"));
    }

    private void handleAudioChunk(WebSocketSession session, Map<String, Object> msg) {
        ASRSession asrSession = asrSessions.get(session.getId());
        if (asrSession == null) {
            sendError(session, "请先设置 API Key");
            return;
        }

        Map<String, Object> payload = (Map<String, Object>) msg.get("payload");
        String pcmData = (String) payload.get("pcm_data");

        asrApplicationService.processAudio(asrSession, pcmData.getBytes(), result -> {
            sendRecognitionResult(session, result);
        });
    }

    private void handleConfig(WebSocketSession session, Map<String, Object> msg) {
        Map<String, Object> payload = (Map<String, Object>) msg.get("payload");
        log.info("收到配置: sessionId={}, config={}", session.getId(), payload);
    }

    private void sendRecognitionResult(WebSocketSession session, RecognitionResult result) {
        Map<String, Object> response = Map.of(
                "type", result.isFinal() ? "asr_final" : "asr_partial",
                "payload", Map.of(
                        "text", result.getText(),
                        "isFinal", result.isFinal(),
                        "confidence", result.getConfidence()
                )
        );
        sendMessage(session, response);
    }

    private void sendError(WebSocketSession session, String message) {
        sendMessage(session, Map.of(
                "type", "error",
                "payload", Map.of("message", message)
        ));
    }

    private void sendMessage(WebSocketSession session, Object message) {
        try {
            if (session.isOpen()) {
                session.sendMessage(new TextMessage(JSON.toJSONString(message)));
            }
        } catch (Exception e) {
            log.error("发送消息失败: sessionId={}", session.getId(), e);
        }
    }
}
