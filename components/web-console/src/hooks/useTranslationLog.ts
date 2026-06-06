import { useRef, useCallback } from 'react';

/**
 * 翻译记录条目
 */
export interface TranslationLogEntry {
  id: number;
  timestamp: string;
  action: 'ADD_TEMP' | 'MARK_FINAL';
  sourceText: string;
  translatedText: string;
  time: number;
}

/**
 * 翻译记录 Hook
 * 记录每一段翻译结果，支持导出
 */
export function useTranslationLog() {
  const logRef = useRef<TranslationLogEntry[]>([]);
  const idRef = useRef(0);

  const addEntry = useCallback((entry: Omit<TranslationLogEntry, 'id' | 'timestamp'>) => {
    const id = ++idRef.current;
    const now = new Date();
    const timestamp = now.toTimeString().substring(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    logRef.current.push({ ...entry, id, timestamp });
  }, []);

  const getLog = useCallback(() => logRef.current, []);

  const clearLog = useCallback(() => {
    logRef.current = [];
    idRef.current = 0;
  }, []);

  /**
   * 导出为可读文本
   */
  const exportAsText = useCallback(() => {
    const lines = logRef.current.map((entry) => {
      const tag = entry.action === 'MARK_FINAL' ? '【最终】' : '【临时】';
      return `[${entry.timestamp}] ${tag} ${entry.translatedText}`;
    });
    return lines.join('\n');
  }, []);

  /**
   * 导出为 JSON
   */
  const exportAsJSON = useCallback(() => {
    return JSON.stringify(logRef.current, null, 2);
  }, []);

  /**
   * 导出为 SRT 字幕格式
   */
  const exportAsSRT = useCallback(() => {
    const finals = logRef.current.filter((e) => e.action === 'MARK_FINAL');
    return finals
      .map((entry, i) => {
        const start = entry.time;
        const end = start + 5000; // 每段默认 5 秒
        const startTime = formatSRTTime(start);
        const endTime = formatSRTTime(end);
        return `${i + 1}\n${startTime} --> ${endTime}\n${entry.translatedText}\n`;
      })
      .join('\n');
  }, []);

  return {
    addEntry,
    getLog,
    clearLog,
    exportAsText,
    exportAsJSON,
    exportAsSRT,
  };
}

/**
 * 格式化 SRT 时间戳 (HH:MM:SS,mmm)
 */
function formatSRTTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;
  return (
    String(hours).padStart(2, '0') + ':' +
    String(minutes).padStart(2, '0') + ':' +
    String(seconds).padStart(2, '0') + ',' +
    String(milliseconds).padStart(3, '0')
  );
}
