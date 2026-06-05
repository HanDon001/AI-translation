import { useState, useCallback } from 'react';

interface GlossaryEntry {
  id: number;
  source: string;
  target: string;
}

interface ConfigPanelProps {
  srcLang: string;
  tgtLang: string;
  sampleRate: string;
  isRunning: boolean;
  onSrcLangChange: (v: string) => void;
  onTgtLangChange: (v: string) => void;
  onSampleRateChange: (v: string) => void;
  onToggle: () => void;
  onGlossaryChange: (glossary: Record<string, string>) => void;
}

let glossaryIdCounter = 0;

export function ConfigPanel({
  srcLang, tgtLang, sampleRate, isRunning,
  onSrcLangChange, onTgtLangChange, onSampleRateChange,
  onToggle,
  onGlossaryChange,
}: ConfigPanelProps) {
  const [entries, setEntries] = useState<GlossaryEntry[]>([
    { id: ++glossaryIdCounter, source: 'Kubernetes', target: 'K8s' },
    { id: ++glossaryIdCounter, source: 'Elasticsearch', target: 'ES' },
  ]);

  const updateEntry = useCallback((id: number, field: 'source' | 'target', value: string) => {
    setEntries((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, [field]: value } : e));
      emitGlossary(next);
      return next;
    });
  }, []);

  const addEntry = useCallback(() => {
    setEntries((prev) => {
      const next = [...prev, { id: ++glossaryIdCounter, source: '', target: '' }];
      return next;
    });
  }, []);

  const emitGlossary = useCallback((list: GlossaryEntry[]) => {
    const g: Record<string, string> = {};
    list.forEach((e) => {
      if (e.source && e.target) g[e.source] = e.target;
    });
    onGlossaryChange(g);
  }, [onGlossaryChange]);

  return (
    <div>
      {/* 参数配置 */}
      <div className="config-section">
        <div className="config-section-title">
          <i className="fa-solid fa-sliders text-[9px]" /> 参数配置
        </div>
        <div className="ctrl-row">
          <span className="ctrl-label">源语言</span>
          <select className="ctrl-select" value={srcLang} onChange={(e) => onSrcLangChange(e.target.value)}>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
            <option value="zh">中文</option>
          </select>
        </div>
        <div className="ctrl-row">
          <span className="ctrl-label">目标语言</span>
          <select className="ctrl-select" value={tgtLang} onChange={(e) => onTgtLangChange(e.target.value)}>
            <option value="zh">中文</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
          </select>
        </div>
        <div className="ctrl-row">
          <span className="ctrl-label">采样率</span>
          <select className="ctrl-select" value={sampleRate} onChange={(e) => onSampleRateChange(e.target.value)}>
            <option value="16000">16000 Hz</option>
            <option value="8000">8000 Hz</option>
          </select>
        </div>
        <div style={{ marginTop: 14 }}>
          <button className={`btn-start ${isRunning ? 'running' : 'idle'}`} onClick={onToggle}>
            {isRunning ? (
              <><i className="fa-solid fa-stop" /><span>停止翻译</span></>
            ) : (
              <><i className="fa-solid fa-play" /><span>开始翻译</span></>
            )}
          </button>
        </div>
      </div>

      {/* 术语表 */}
      <div className="config-section">
        <div className="config-section-title">
          <i className="fa-solid fa-book text-[9px]" /> 术语表
        </div>
        {entries.map((entry) => (
          <div className="glossary-row" key={entry.id}>
            <input
              placeholder="原文术语"
              value={entry.source}
              onChange={(e) => updateEntry(entry.id, 'source', e.target.value)}
            />
            <span style={{ color: 'var(--muted)', fontSize: 9 }}>
              <i className="fa-solid fa-arrow-right" />
            </span>
            <input
              placeholder="译文术语"
              value={entry.target}
              onChange={(e) => updateEntry(entry.id, 'target', e.target.value)}
            />
          </div>
        ))}
        <button className="glossary-add" onClick={addEntry}>
          <i className="fa-solid fa-plus" /> 添加术语
        </button>
      </div>
    </div>
  );
}
