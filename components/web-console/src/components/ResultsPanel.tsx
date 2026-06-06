export interface TranslationResult {
  id: number;
  source: string;
  target: string;
  latency?: number;
  isStreaming: boolean;
  time: string;
}

interface ResultsPanelProps {
  results: TranslationResult[];
  sentenceCount: number;
  avgLatency: string;
  elapsedTime: string;
  liveSrc: string;
  liveTgt: string;
  liveLabel: string;
  isRunning: boolean;
  isTranslating: boolean;
}

export function ResultsPanel({
  results, sentenceCount, avgLatency, elapsedTime,
  liveSrc, liveTgt, liveLabel, isRunning, isTranslating,
}: ResultsPanelProps) {
  return (
    <>
      <div className="results-header">
        <h2><i className="fa-solid fa-closed-captioning" /> 翻译结果</h2>
        <div className="results-stats">
          <span>句数 <span className="val">{sentenceCount}</span></span>
          <span>平均延迟 <span className="val">{avgLatency}</span></span>
          <span>已用时 <span className="val">{elapsedTime}</span></span>
        </div>
      </div>

      <div className="results-list">
        {/* 空状态 */}
        {!isRunning && results.length === 0 && (
          <div className="result-empty">
            <i className="fa-solid fa-satellite-dish" />
            <p>点击「开始翻译」启动实时翻译</p>
          </div>
        )}

        {/* 实时卡片 */}
        {isRunning && (
          <div className={`result-card ${liveSrc ? 'is-streaming' : ''}`}>
            <div className="result-meta">
              <span className="idx">LIVE</span>
              <span>{liveLabel}</span>
            </div>
            <div className="result-source">{liveSrc || '等待语音输入...'}</div>
            <div className="result-divider" />
            <div className={`result-target ${isTranslating ? 'translating' : ''}`}>
              {liveTgt || ''}
            </div>
          </div>
        )}

        {/* 之前的结果 */}
        {results.map((r) => (
          <div key={r.id} className="result-card">
            <div className="result-meta">
              <span className="idx">#{String(r.id).padStart(2, '0')}</span>
              <span>{r.time}</span>
              {r.latency != null && <span className="lat">{r.latency}ms</span>}
            </div>
            <div className="result-source">{r.source}</div>
            <div className="result-target">{r.target}</div>
          </div>
        ))}
      </div>
    </>
  );
}
