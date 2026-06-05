package com.livetranslate.common.core.util;

import java.util.Base64;

/**
 * 音频转换工具
 * 对应原 TypeScript 的 Float32/Base64 转换逻辑
 */
public final class AudioConvertUtil {

    private AudioConvertUtil() {}

    /**
     * 将 PCM16 字节数组转换为 Base64 字符串
     */
    public static String pcm16ToBase64(byte[] pcmData) {
        return Base64.getEncoder().encodeToString(pcmData);
    }

    /**
     * 将 Base64 字符串解码为 PCM16 字节数组
     */
    public static byte[] base64ToPcm16(String base64) {
        return Base64.getDecoder().decode(base64);
    }

    /**
     * 将 Float32 数组转换为 PCM16 字节数组
     */
    public static byte[] float32ToPcm16(float[] float32Data) {
        byte[] pcm16 = new byte[float32Data.length * 2];
        for (int i = 0; i < float32Data.length; i++) {
            float sample = Math.max(-1.0f, Math.min(1.0f, float32Data[i]));
            short pcmSample = (short) (sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
            pcm16[i * 2] = (byte) (pcmSample & 0xFF);
            pcm16[i * 2 + 1] = (byte) ((pcmSample >> 8) & 0xFF);
        }
        return pcm16;
    }

    /**
     * 将 PCM16 字节数组转换为 Float32 数组
     */
    public static float[] pcm16ToFloat32(byte[] pcm16) {
        float[] float32 = new float[pcm16.length / 2];
        for (int i = 0; i < float32.length; i++) {
            short sample = (short) ((pcm16[i * 2] & 0xFF) | (pcm16[i * 2 + 1] << 8));
            float32[i] = sample / 32768.0f;
        }
        return float32;
    }
}
