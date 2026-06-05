import { useRef, useCallback, useState } from 'react';

/**
 * 浏览器 Web Speech API 语音识别 Hook
 * 实时将语音转为文本
 */
export function useSpeechRecognition() {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);

  const start = useCallback((onResult: (text: string, isFinal: boolean) => void, lang = 'en-US') => {
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
      if (event.error === 'no-speech') {
        // 无语音，静默重启
        try { recognition.start(); } catch {}
      }
    };

    recognition.onend = () => {
      // 自动重启（保持持续监听）
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
      recognitionRef.current.onend = null; // 阻止自动重启
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  return { start, stop, isListening };
}
