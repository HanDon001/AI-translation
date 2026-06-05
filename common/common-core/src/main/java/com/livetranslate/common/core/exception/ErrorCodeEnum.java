package com.livetranslate.common.core.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 业务异常码枚举
 * 对应原 TypeScript 的类型守卫
 */
@Getter
@AllArgsConstructor
public enum ErrorCodeEnum {

    // 通用
    SUCCESS(0, "成功"),
    SYSTEM_ERROR(10000, "系统错误"),
    PARAM_ERROR(10001, "参数错误"),
    UNAUTHORIZED(10002, "未授权"),
    FORBIDDEN(10003, "无权限"),

    // ASR 相关
    ASR_SESSION_NOT_FOUND(20001, "ASR 会话不存在"),
    ASR_AUDIO_FORMAT_ERROR(20002, "音频格式错误"),
    ASR_ENGINE_ERROR(20003, "ASR 引擎错误"),
    ASR_DASHSCOPE_ERROR(20004, "DashScope 连接失败"),

    // 翻译相关
    TRANSLATE_ERROR(30001, "翻译失败"),
    TRANSLATE_TIMEOUT(30002, "翻译超时"),
    TRANSLATE_UNSUPPORTED_LANG(30003, "不支持的语言"),

    // 认证相关
    API_KEY_MISSING(40001, "缺少 API Key"),
    API_KEY_INVALID(40002, "API Key 无效"),
    API_KEY_EXPIRED(40003, "API Key 已过期"),

    // WebSocket 相关
    WS_CONNECT_ERROR(50001, "WebSocket 连接失败"),
    WS_MESSAGE_ERROR(50002, "WebSocket 消息解析错误"),
    WS_SESSION_CLOSED(50003, "WebSocket 会话已关闭");

    private final int code;
    private final String message;
}
