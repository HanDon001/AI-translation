package com.livetranslate.common.core.constant;

/**
 * 音频常量
 * 对应原 TypeScript 的 constants.ts
 */
public final class AudioConstant {

    private AudioConstant() {}

    /** 默认采样率 */
    public static final int DEFAULT_SAMPLE_RATE = 16000;

    /** 音频窗口大小（毫秒） */
    public static final int WINDOW_MS = 400;

    /** 音频格式 */
    public static final String AUDIO_FORMAT_PCM = "pcm";
    public static final String AUDIO_FORMAT_WEBM = "webm";

    /** DashScope 模型 */
    public static final String MODEL_ASR = "qwen3-asr-flash-realtime";
    public static final String MODEL_TRANSLATE = "qwen3.5-livetranslate-flash-realtime";

    /** WebSocket URL */
    public static final String DASHSCOPE_WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime";
}
