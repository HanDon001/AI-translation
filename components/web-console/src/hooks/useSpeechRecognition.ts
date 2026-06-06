import { useRef, useCallback, useState } from 'react';

/**
 * 浏览器 Web Speech API 语音识别 Hook
 * 实时将语音转为文本
 */
export function useSpeechRecognition() {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);

  const start = useCallback((
    onResult: (text: string, isFinal: boolean) => void,
    lang = 'en-US',
    onNetworkError?: () => void,
  ) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      throw new Error('此浏览器不支持语音识别，请使用 Chrome');
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        onResult(text, result.isFinal);
      }
    };

    recognition.onerror = (event) => {
      console.error('[SpeechRecognition] Error:', event.error);
      if (event.error === 'network') {
        // 网络错误：无法连接 Google 语音服务，停止重试，通知调用方降级
        console.warn('[SpeechRecognition] Network error, falling back to demo mode');
        recognitionRef.current = null;
        setIsListening(false);
        onNetworkError?.();
        return;
      }
      if (event.error === 'no-speech') {
        try { recognition.start(); } catch {}
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current) {
        try { recognition.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  return { start, stop, isListening };
}
