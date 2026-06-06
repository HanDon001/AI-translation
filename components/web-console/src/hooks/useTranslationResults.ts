import { useCallback, useRef, useState } from 'react';
import type { TranslationResult } from '../components/ResultsPanel';

export function useTranslationResults() {
  const [results, setResults] = useState<TranslationResult[]>([]);
  const [sentenceCount, setSentenceCount] = useState(0);
  const [avgLatency, setAvgLatency] = useState('--');

  const resultIdRef = useRef(0);
  const latenciesRef = useRef<number[]>([]);

  const addResult = useCallback((src: string, tgt: string | null, latency?: number) => {
    const now = new Date();
    const timeStr = now.toTimeString().substring(0, 8);
    const id = ++resultIdRef.current;

    if (latency !== undefined) {
      latenciesRef.current.push(latency);
    }

    const lastLatency = latenciesRef.current.length > 0
      ? latenciesRef.current[latenciesRef.current.length - 1]
      : undefined;

    setResults((prev) => [{ id, source: src, target: tgt || '', latency: lastLatency, isStreaming: false, time: timeStr }, ...prev]);
    setSentenceCount((c) => c + 1);

    if (latenciesRef.current.length > 0) {
      const avg = Math.round(latenciesRef.current.reduce((a, b) => a + b, 0) / latenciesRef.current.length);
      setAvgLatency(`${avg}ms`);
    }
  }, []);

  const resetResults = useCallback(() => {
    setResults([]);
    setSentenceCount(0);
    setAvgLatency('--');
    latenciesRef.current = [];
    resultIdRef.current = 0;
  }, []);

  const getAvgLatency = useCallback(() => {
    if (latenciesRef.current.length === 0) return 0;
    return Math.round(latenciesRef.current.reduce((a, b) => a + b, 0) / latenciesRef.current.length);
  }, []);

  return { results, sentenceCount, avgLatency, addResult, resetResults, getAvgLatency, latenciesRef };
}
