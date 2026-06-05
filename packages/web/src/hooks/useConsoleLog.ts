import { useCallback, useEffect, useState } from 'react';

export type LogType = 'info' | 'ok' | 'data' | 'warn' | 'err';

export interface LogEntry {
  id: number;
  type: LogType;
  time: string;
  msg: string;
}

let logIdCounter = 0;
const listeners = new Set<() => void>();
let logs: LogEntry[] = [];

function notify() {
  listeners.forEach((fn) => fn());
}

function now() {
  return new Date().toTimeString().substring(0, 8);
}

export function addConsoleLog(type: LogType, msg: string) {
  logs = [...logs, { id: ++logIdCounter, type, time: now(), msg }];
  if (logs.length > 500) logs = logs.slice(-500);
  notify();
}

export function clearConsoleLogs() {
  logs = [];
  notify();
}

export function getLogs(): LogEntry[] {
  return logs;
}

export function useConsoleLogs() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  // tick is used to trigger re-renders when logs change
  void tick;
  return { logs, clear: clearConsoleLogs, add: addConsoleLog };
}

/** Hook for adding logs from anywhere */
export function useLog() {
  return useCallback((type: LogType, msg: string) => {
    addConsoleLog(type, msg);
  }, []);
}
