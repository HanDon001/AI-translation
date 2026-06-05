import { useRef, useEffect } from 'react';
import type { LogEntry } from '../hooks/useConsoleLog';

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
      <div className="log-header">
        <h2><i className="fa-solid fa-terminal" /> 实时日志</h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="log-count">{logs.length}</span>
          <button className="log-clear" onClick={onClear}>清空</button>
        </div>
      </div>
      <div className="log-list" ref={listRef}>
        {logs.map((entry) => (
          <div key={entry.id} className={`log-entry type-${entry.type}`}>
            <span className="log-time">{entry.time}</span>
            <span className="log-tag">{TAG_MAP[entry.type] || 'INFO'}</span>
            <span
              className="log-msg"
              dangerouslySetInnerHTML={{ __html: entry.msg }}
            />
          </div>
        ))}
      </div>
    </>
  );
}
