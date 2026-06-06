import styles from '../styles/console.module.css';

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
      <div className={styles.resultsHeader}>
        <h2><i className="fa-solid fa-closed-captioning" /> 翻译结果</h2>
        <div className={styles.resultsStats}>
          <span>句数 <span className={styles.val}>{sentenceCount}</span></span>
          <span>平均延迟 <span className={styles.val}>{avgLatency}</span></span>
          <span>已用时 <span className={styles.val}>{elapsedTime}</span></span>
        </div>
      </div>

      <div className={styles.resultsList}>
        {!isRunning && results.length === 0 && (
          <div className={styles.resultEmpty}>
            <i className="fa-solid fa-satellite-dish" />
            <p>点击「开始翻译」启动实时翻译</p>
          </div>
        )}

        {isRunning && (
          <div className={`${styles.resultCard} ${liveSrc ? styles.isStreaming : ''}`}>
            <div className={styles.resultMeta}>
              <span className={styles.idx}>LIVE</span>
              <span>{liveLabel}</span>
            </div>
            <div className={styles.resultSource}>{liveSrc || '等待语音输入...'}</div>
            <div className={styles.resultDivider} />
            <div className={`${styles.resultTarget} ${isTranslating ? styles.translating : ''}`}>
              {liveTgt || ''}
            </div>
          </div>
        )}

        {results.map((r) => (
          <div key={r.id} className={styles.resultCard}>
            <div className={styles.resultMeta}>
              <span className={styles.idx}>#{String(r.id).padStart(2, '0')}</span>
              <span>{r.time}</span>
              {r.latency != null && <span className={styles.lat}>{r.latency}ms</span>}
            </div>
            <div className={styles.resultSource}>{r.source}</div>
            <div className={styles.resultTarget}>{r.target}</div>
          </div>
        ))}
      </div>
    </>
  );
}
