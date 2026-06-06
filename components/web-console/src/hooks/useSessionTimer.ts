import { useCallback, useRef, useState } from 'react';

export function useSessionTimer() {
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const sessionSecondsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    sessionSecondsRef.current = 0;
    timerRef.current = setInterval(() => {
      sessionSecondsRef.current++;
      const m = Math.floor(sessionSecondsRef.current / 60);
      const s = sessionSecondsRef.current % 60;
      setElapsedTime(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { elapsedTime, startTimer, stopTimer };
}
