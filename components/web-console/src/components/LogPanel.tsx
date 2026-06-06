import { useRef, useEffect } from 'react';
import type { LogEntry } from '../hooks/useConsoleLog';
import styles from '../styles/console.module.css';

interface LogPanelProps {
  logs: LogEntry[];
  onClear: () => void;
}

const TAG_MAP: Record<string, string> = {
  info: 'INFO',
  ok: ' OK ',
  data: 'DATA',
  warn: 'WARN',
  err: ' ERR',
};

export function LogPanel({ logs, onClear }: LogPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [logs.length]);

  return (
    <>
      <div className={styles.logHeader}>
        <h2><i className="fa-solid fa-terminal" /> 实时日志</h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className={styles.logCount}>{logs.length}</span>
          <button className={styles.logClear} onClick={onClear}>清空</button>
        </div>
      </div>
      <div className={styles.logList} ref={listRef}>
        {logs.map((entry) => (
          <div key={entry.id} className={`${styles.logEntry} ${styles[`type-${entry.type}`]}`}>
            <span className={styles.logTime}>{entry.time}</span>
            <span className={styles.logTag}>{TAG_MAP[entry.type] || 'INFO'}</span>
            <span
              className={styles.logMsg}
              dangerouslySetInnerHTML={{ __html: entry.msg }}
            />
          </div>
        ))}
      </div>
    </>
  );
}
