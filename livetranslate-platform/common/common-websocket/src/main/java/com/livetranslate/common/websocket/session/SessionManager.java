package com.livetranslate.common.websocket.session;

import lombok.extern.slf4j.Slf4j;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket 会话管理器
 * 对应原 TypeScript 的 connState 管理
 */
@Slf4j
public class SessionManager {

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    /**
     * 添加会话
     */
    public void add(String sessionId, WebSocketSession session) {
        sessions.put(sessionId, session);
        log.info("WebSocket 会话已添加: sessionId={}, 总数={}", sessionId, sessions.size());
    }

    /**
     * 移除会话
     */
    public void remove(String sessionId) {
        sessions.remove(sessionId);
        log.info("WebSocket 会话已移除: sessionId={}, 总数={}", sessionId, sessions.size());
    }

    /**
     * 获取会话
     */
    public WebSocketSession get(String sessionId) {
        return sessions.get(sessionId);
    }

    /**
     * 发送消息给指定会话
     */
    public void send(String sessionId, String message) {
        WebSocketSession session = sessions.get(sessionId);
        if (session != null && session.isOpen()) {
            try {
                session.sendMessage(new org.springframework.web.socket.TextMessage(message));
            } catch (IOException e) {
                log.error("发送消息失败: sessionId={}", sessionId, e);
            }
        }
    }

    /**
     * 广播消息给所有会话
     */
    public void broadcast(String message) {
        sessions.forEach((sessionId, session) -> {
            if (session.isOpen()) {
                send(sessionId, message);
            }
        });
    }

    /**
     * 获取会话数量
     */
    public int size() {
        return sessions.size();
    }
}
