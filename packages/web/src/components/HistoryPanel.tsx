interface HistoryItem {
  src: string;
  tgt: string | null;
  err?: string;
  time: string;
}

interface HistoryPanelProps {
  history: HistoryItem[];
}

export function HistoryPanel({ history }: HistoryPanelProps) {
  return (
    <>
      <div className="history-header">
        <h3><i className="fa-solid fa-clock-rotate-left" /> 翻译历史</h3>
        <span className="history-count">{history.length}</span>
      </div>
      <div className="history-list">
        {history.length === 0 ? (
          <div className="history-empty">暂无记录</div>
        ) : (
          history.slice(0, 100).map((item, i) => (
            <div key={i} className="history-item">
              <div className="history-time">{item.time}</div>
              <div className="history-text">
                <div className="src">{item.src}</div>
                {item.err ? (
                  <div className="err">{item.err}</div>
                ) : (
                  <div className="tgt">{item.tgt || ''}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
