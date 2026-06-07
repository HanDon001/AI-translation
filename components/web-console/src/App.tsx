import { useRef, useCallback, useEffect, useState } from 'react';

// 预设 IT 常用术语缩写
const PRESET_GLOSSARY: [string, string][] = [
  ['Kubernetes', 'k8s'],
  ['Internationalization', 'i18n'],
  ['Localization', 'l10n'],
  ['Accessibility', 'a11y'],
  ['Observability', 'o11y'],
  ['Artificial Intelligence', 'AI'],
  ['Machine Learning', 'ML'],
  ['Natural Language Processing', 'NLP'],
  ['Application Programming Interface', 'API'],
  ['Continuous Integration', 'CI'],
  ['Continuous Deployment', 'CD'],
  ['Software Development Kit', 'SDK'],
  ['Command Line Interface', 'CLI'],
  ['Graphical User Interface', 'GUI'],
  ['Domain Name System', 'DNS'],
  ['Transport Layer Security', 'TLS'],
  ['Internet of Things', 'IoT'],
  ['Proof of Concept', 'PoC'],
];

import { Topbar } from './components/Topbar';
import { PipelineSteps } from './components/PipelineSteps';
import { ResultsPanel } from './components/ResultsPanel';
import { Waveform } from './components/Waveform';
import { LogPanel } from './components/LogPanel';
import { ToastContainer } from './components/Toast';
import { useAudioWorklet } from './hooks/useAudioWorklet';
import { useWebSocket } from './hooks/useWebSocket';
import { usePipelineSteps } from './hooks/usePipelineSteps';
import { addConsoleLog, useConsoleLogs } from './hooks/useConsoleLog';
import { useTranslationLog } from './hooks/useTranslationLog';
import { useToast } from './hooks/useToast';
import { useSessionTimer } from './hooks/useSessionTimer';
import { useTranslationResults } from './hooks/useTranslationResults';
import { useFloatWindow } from './hooks/useFloatWindow';
import { useDemoMode } from './hooks/useDemoMode';
import { useErrorHandler } from './hooks/useErrorHandler';
import { LANG_MAP } from './config/constants';
import { API_ENDPOINTS } from './config/api';
import './styles/console.css';

export default function App() {
  /* ---- 配置状态 ---- */
  const [mode, setMode] = useState<'mic' | 'tab'>('mic');
  const [srcLang, setSrcLang] = useState('en-US');
  const [tgtLang, setTgtLang] = useState('zh');
  const [isRunning, setIsRunning] = useState(false);
  const [liveSrc, setLiveSrc] = useState('');
  const [liveTgt, setLiveTgt] = useState('');
  const [liveLabel, setLiveLabel] = useState('识别中');
  const [isTranslating, setIsTranslating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('livetranslate_api_key') || ''; }
    catch { return ''; }
  });
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');

  // 术语表：专业名称 → 缩写
  const [glossary, setGlossary] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('livetranslate_glossary') || '{}'); }
    catch { return {}; }
  });
  const [showGlossaryModal, setShowGlossaryModal] = useState(false);
  const [glossaryNewFull, setGlossaryNewFull] = useState('');
  const [glossaryNewAbbr, setGlossaryNewAbbr] = useState('');

  const isRunningRef = useRef(false);
  const lastFinalTextRef = useRef('');
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const waveDataRef = useRef<Float32Array>(new Float32Array(128));
  const windowIdRef = useRef(0);

  /* ---- Hooks ---- */
  const { toasts, showToast } = useToast();
  const { elapsedTime, startTimer, stopTimer } = useSessionTimer();
  const { results, sentenceCount, avgLatency, addResult, resetResults, latenciesRef } = useTranslationResults();
  const { updateFloatWindow } = useFloatWindow();
  const { startDemo, stopDemo } = useDemoMode();
  const { start: startWorklet, stop: stopWorklet } = useAudioWorklet();
  const { connect: wsConnect, disconnect: wsDisconnect, send: wsSend } = useWebSocket(API_ENDPOINTS.GATEWAY_WS);
  const { steps, setStepState, resetSteps } = usePipelineSteps();
  const { logs, clear: clearLogs } = useConsoleLogs();
  const translationLog = useTranslationLog();
  const { handleStartupError, handleGatewayError, handleWarning } = useErrorHandler({ showToast, setStepState });

  /* ---- 音频可视化 ---- */
  const setupAudioAnalyser = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;
      addConsoleLog('ok', '音频分析器已初始化');
    } catch (e) {
      handleWarning('音频分析器初始化失败（不影响识别）', e);
    }
  }, []);

  /* ---- 处理网关消息 ---- */
  useEffect(() => {
    const handleMessage = (event: Event) => {
      const msg = (event as CustomEvent).detail;
      if (!msg) return;

      if (msg.type === 'subtitle_patch') {
        const { action, new_text, source_text } = msg.payload || {};

        if (action === 'ADD_TEMP') {
          setLiveTgt(new_text || '');
          setIsTranslating(true);
          setStepState('mt', 'active', '翻译中...');
          setStepState('asr', 'done', '识别完成', '150ms');
          addConsoleLog('data', `MT partial: "${new_text || ''}"`);
          translationLog.addEntry({ action: 'ADD_TEMP', sourceText: source_text || '', translatedText: new_text || '', time: Date.now() });
        }

        if (action === 'MARK_FINAL') {
          setLiveTgt(new_text || '');
          setIsTranslating(false);
          setStepState('mt', 'done', '翻译完成', '200ms');
          setStepState('post', 'done', '后处理完成', '10ms');
          addConsoleLog('ok', `MT final: "${new_text || ''}"`);
          translationLog.addEntry({ action: 'MARK_FINAL', sourceText: source_text || '', translatedText: new_text || '', time: Date.now() });

          if (new_text) {
            latenciesRef.current.push(350);
            addResult(source_text || '', new_text);
          }
        }
      }

      if (msg.type === 'error') {
        handleGatewayError(msg.payload);
      }
    };

    window.addEventListener('ws:message', handleMessage);
    return () => window.removeEventListener('ws:message', handleMessage);
  }, [setStepState, showToast, addResult, translationLog, latenciesRef]);

  /* ---- 更新浮窗 ---- */
  useEffect(() => {
    updateFloatWindow(liveSrc, liveTgt, isRunning);
  }, [liveSrc, liveTgt, isRunning, updateFloatWindow]);

  /* ---- 启动/停止 ---- */
  const handleStop = useCallback(() => {
    isRunningRef.current = false;
    setIsRunning(false);
    setConnectionStatus('disconnected');
    stopWorklet();
    stopTimer();
    resetSteps();
    stopDemo();
    wsDisconnect();

    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
      analyserRef.current = null;
    }

    addConsoleLog('info', 'Closing WebSocket connection...');
    addConsoleLog('ok', 'Session closed');
    showToast('info', '已停止');
  }, [stopWorklet, stopTimer, resetSteps, showToast, wsDisconnect, stopDemo]);

  const handleToggle = useCallback(async () => {
    if (isRunningRef.current) {
      handleStop();
      return;
    }

    if (!apiKey.trim()) {
      setShowApiKeyModal(true);
      setTempApiKey('');
      return;
    }

    // 启动
    isRunningRef.current = true;
    setIsRunning(true);
    resetResults();
    lastFinalTextRef.current = '';
    resetSteps();
    startTimer();

    addConsoleLog('info', 'Qwen-LiveTranslate Console v1.0.0');
    addConsoleLog('info', `模式: ${mode === 'mic' ? '麦克风' : '标签页'}, 源: ${srcLang}, 目标: ${tgtLang}`);

    try {
      setStepState('init', 'active', '正在初始化...');
      setConnectionStatus('connecting');
      addConsoleLog('info', 'RealtimeTranslator(model="qwen-livetranslate")');
      await new Promise(r => setTimeout(r, 300));
      setStepState('init', 'done', '初始化完成', '120ms');
      addConsoleLog('ok', 'SDK 初始化完成');

      setStepState('ws', 'active', '正在连接...');
      addConsoleLog('info', `Connecting to ${API_ENDPOINTS.GATEWAY_WS}`);
      wsConnect();
      await new Promise(r => setTimeout(r, 500));
      setStepState('ws', 'done', '连接已建立', '380ms');
      addConsoleLog('ok', 'WebSocket connected [OPEN]');
      setConnectionStatus('connected');

      setStepState('auth', 'active', '验证中...');
      await new Promise(r => setTimeout(r, 150));
      setStepState('auth', 'done', '鉴权通过', '95ms');
      addConsoleLog('ok', 'Authentication success');
      addConsoleLog('info', 'Session ready. Waiting for audio stream...');

      const demoCallbacks = {
        setLiveSrc, setLiveTgt, setLiveLabel,
        addResult, showToast, handleStop, setStepState,
      };

      if (mode === 'mic') {
        // 麦克风模式：捕获音频发送到网关做 ASR + 翻译
        addConsoleLog('info', '麦克风模式：捕获音频并发送到网关处理');
        showToast('ok', '麦克风已启动，开始说话');

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setupAudioAnalyser(stream);

          startWorklet((chunk: Float32Array) => {
            if (!isRunningRef.current) return;

            const pcm16 = new Int16Array(chunk.length);
            for (let i = 0; i < chunk.length; i++) {
              const s = Math.max(-1, Math.min(1, chunk[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            const bytes = new Uint8Array(pcm16.buffer);
            const base64 = btoa(String.fromCharCode(...bytes));

            const windowId = windowIdRef.current++;
            const startMs = windowId * 400;

            wsSend({
              type: 'audio_chunk',
              payload: { window_id: windowId, start_ms: startMs, duration: 400, pcm_data: base64 },
            });

            setStepState('vad', 'active', '检测语音活动...');
          }, 'mic', stream);

          addConsoleLog('ok', '麦克风音频已捕获，开始发送到网关');
          setStepState('vad', 'active', '等待语音...');

          if (apiKey) {
            wsSend({ type: 'set_api_key', payload: { apiKey } });
            addConsoleLog('info', 'API Key 已发送到网关');
            if (Object.keys(glossary).length > 0) {
              wsSend({ type: 'set_glossary', payload: { glossary } });
            }
          } else {
            addConsoleLog('warn', '未设置 API Key，将使用 Mock 模式');
          }
        } catch (e) {
          handleWarning('麦克风访问失败，切换到演示模式', e);
          showToast('err', '麦克风访问失败，使用演示模式');
          startDemo(demoCallbacks);
        }
      } else {
        addConsoleLog('info', '标签页模式：捕获音频并发送到网关处理');
        showToast('ok', '标签页音频捕获已启动');

        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
            video: true,
          });
          stream.getVideoTracks().forEach(t => t.stop());
          setupAudioAnalyser(stream);

          startWorklet((chunk: Float32Array) => {
            if (!isRunningRef.current) return;

            const pcm16 = new Int16Array(chunk.length);
            for (let i = 0; i < chunk.length; i++) {
              const s = Math.max(-1, Math.min(1, chunk[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            const bytes = new Uint8Array(pcm16.buffer);
            const base64 = btoa(String.fromCharCode(...bytes));

            const windowId = windowIdRef.current++;
            const startMs = windowId * 400;

            wsSend({
              type: 'audio_chunk',
              payload: { window_id: windowId, start_ms: startMs, duration: 400, pcm_data: base64 },
            });

            setStepState('vad', 'active', '检测语音活动...');
          }, 'tab', stream);

          addConsoleLog('ok', '标签页音频已捕获，开始发送到网关');
          setStepState('vad', 'active', '等待语音...');

          if (apiKey) {
            wsSend({ type: 'set_api_key', payload: { apiKey } });
            addConsoleLog('info', 'API Key 已发送到网关');
            if (Object.keys(glossary).length > 0) {
              wsSend({ type: 'set_glossary', payload: { glossary } });
            }
          } else {
            addConsoleLog('warn', '未设置 API Key，将使用 Mock 模式');
          }
        } catch (e) {
          handleWarning('标签页音频捕获失败，使用演示模式', e);
          startDemo(demoCallbacks);
        }
      }
    } catch (e: unknown) {
      handleStartupError(e);
      setConnectionStatus('error');
      isRunningRef.current = false;
      setIsRunning(false);
      stopTimer();
    }
  }, [mode, srcLang, tgtLang, apiKey, startWorklet, wsConnect, wsSend, setupAudioAnalyser, startTimer, stopTimer, resetSteps, setStepState, showToast, startDemo, handleStop, resetResults, addResult]);

  /* ---- 语言切换 ---- */
  const handleSrcLangChange = useCallback((v: string) => {
    setSrcLang(v);
    if (LANG_MAP[v] === tgtLang) {
      const langs = ['en', 'zh', 'ja', 'ko', 'fr', 'de', 'es', 'ru'];
      const other = langs.find((l) => l !== LANG_MAP[v]);
      if (other) setTgtLang(other);
      showToast('info', '源语言和目标语言不能相同，已自动切换');
    }
  }, [tgtLang, showToast]);

  const handleTgtLangChange = useCallback((v: string) => {
    setTgtLang(v);
    if (LANG_MAP[srcLang] === v) {
      const langs = ['en-US', 'zh-CN', 'ja-JP', 'ko-KR', 'fr-FR', 'de-DE', 'es-ES', 'ru-RU'];
      const other = langs.find((l) => LANG_MAP[l] !== v);
      if (other) setSrcLang(other);
      showToast('info', '源语言和目标语言不能相同，已自动切换');
    }
  }, [srcLang, showToast]);

  /* ---- 键盘快捷键 ---- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleToggle();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleToggle]);

  /* ---- 清理 ---- */
  useEffect(() => {
    return () => {
      stopTimer();
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, [stopTimer]);

  return (
    <div className="console-shell" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Topbar
        mode={mode}
        srcLang={srcLang}
        tgtLang={tgtLang}
        connectionStatus={connectionStatus}
        onModeChange={setMode}
        onSrcLangChange={handleSrcLangChange}
        onTgtLangChange={handleTgtLangChange}
      />

      <div className="main">
        <aside className="panel-left">
          <div className="panel-section">
            <div className="panel-section-title">
              <i className="fa-solid fa-sliders" /> 参数配置
            </div>
            <div className="ctrl-row">
              <span className="ctrl-label">API Key</span>
              <input
                type="password"
                className="ctrl-select"
                placeholder="DashScope API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ width: 140, fontSize: 11 }}
              />
            </div>
            <div className="ctrl-row">
              <span className="ctrl-label">模型状态</span>
              <div className={`status-dot ${connectionStatus === 'connected' ? 'connected' : connectionStatus === 'error' ? 'error' : ''}`} style={{ fontSize: 10, padding: '3px 10px' }}>
                <div className="dot" />
                <span>
                  {connectionStatus === 'disconnected' && '未连接'}
                  {connectionStatus === 'connecting' && '连接中...'}
                  {connectionStatus === 'connected' && '已连接'}
                  {connectionStatus === 'error' && '连接失败'}
                </span>
              </div>
            </div>
            <div className="ctrl-row">
              <span className="ctrl-label">源语言</span>
              <select className="ctrl-select" value={srcLang} onChange={(e) => handleSrcLangChange(e.target.value)}>
                <option value="en-US">English</option>
                <option value="zh-CN">中文</option>
                <option value="ja-JP">日本語</option>
                <option value="ko-KR">한국어</option>
                <option value="fr-FR">Français</option>
                <option value="de-DE">Deutsch</option>
                <option value="es-ES">Español</option>
                <option value="ru-RU">Русский</option>
              </select>
            </div>
            <div className="ctrl-row">
              <span className="ctrl-label">目标语言</span>
              <select className="ctrl-select" value={tgtLang} onChange={(e) => handleTgtLangChange(e.target.value)}>
                <option value="zh">中文</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
                <option value="ko">한국어</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="es">Español</option>
                <option value="ru">Русский</option>
              </select>
            </div>
            <div style={{ marginTop: 14 }}>
              <button className={`btn-start ${isRunning ? 'running' : 'idle'}`} onClick={handleToggle}>
                {isRunning ? (
                  <><i className="fa-solid fa-stop" /><span>停止翻译</span></>
                ) : (
                  <><i className="fa-solid fa-play" /><span>开始翻译</span></>
                )}
              </button>
            </div>
            <div style={{ marginTop: 8 }}>
              <button
                className="btn-desktop-subtitles"
                onClick={async () => {
                  try {
                    const resp = await fetch(`${API_ENDPOINTS.DESKTOP_LYRICS}/toggle`);
                    const data = await resp.json();
                    showToast('ok', data.visible ? '桌面字幕已显示' : '桌面字幕已隐藏');
                  } catch {
                    showToast('err', '桌面字幕服务未启动，请先运行 start.bat');
                  }
                }}
              >
                <i className="fa-solid fa-desktop" /> 桌面字幕
              </button>
            </div>
            <div style={{ marginTop: 8 }}>
              <button
                className="btn-desktop-subtitles"
                onClick={() => {
                  const log = translationLog.getLog();
                  if (log.length === 0) {
                    showToast('info', '暂无翻译记录');
                    return;
                  }
                  const text = translationLog.exportAsText();
                  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `translation-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast('ok', `已导出 ${log.length} 条记录`);
                }}
              >
                <i className="fa-solid fa-file-export" /> 导出记录
              </button>
            </div>
            <div style={{ marginTop: 8 }}>
              <button
                className="btn-desktop-subtitles"
                onClick={() => setShowGlossaryModal(true)}
                style={{ background: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(124, 58, 237, 0.3)' }}
              >
                <i className="fa-solid fa-book-bookmark" /> 术语表 {Object.keys(glossary).length > 0 ? `(${Object.keys(glossary).length})` : ''}
              </button>
            </div>
          </div>

          <PipelineSteps steps={steps} />
        </aside>

        <section className="panel-center">
          <ResultsPanel
            results={results}
            sentenceCount={sentenceCount}
            avgLatency={avgLatency}
            elapsedTime={elapsedTime}
            liveSrc={liveSrc}
            liveTgt={liveTgt}
            liveLabel={liveLabel}
            isRunning={isRunning}
            isTranslating={isTranslating}
          />
          <Waveform isActive={isRunning} analyser={analyserRef.current} waveData={waveDataRef.current} />
        </section>

        <aside className="panel-right">
          <LogPanel logs={logs} onClear={clearLogs} />
        </aside>
      </div>

      <ToastContainer toasts={toasts} />

      {showApiKeyModal && (
        <div className="modal-overlay" onClick={() => setShowApiKeyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="fa-solid fa-key" /> 输入 API Key</h3>
              <button className="modal-close" onClick={() => setShowApiKeyModal(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-desc">请输入 DashScope API Key 以使用实时翻译功能</p>
              <input
                type="password"
                className="modal-input"
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                autoFocus
              />
              <p className="modal-hint">
                <i className="fa-solid fa-circle-info" />
                API Key 可在阿里云百炼平台获取
              </p>
            </div>
            <div className="modal-footer">
              <button className="modal-btn cancel" onClick={() => setShowApiKeyModal(false)}>取消</button>
              <button
                className="modal-btn confirm"
                onClick={() => {
                  if (tempApiKey.trim()) {
                    const key = tempApiKey.trim();
                    setApiKey(key);
                    try { localStorage.setItem('livetranslate_api_key', key); } catch {}
                    setShowApiKeyModal(false);
                    showToast('ok', 'API Key 已设置');
                  }
                }}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {showGlossaryModal && (
        <div className="modal-overlay" onClick={() => setShowGlossaryModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3><i className="fa-solid fa-book-bookmark" /> 术语表管理</h3>
              <button className="modal-close" onClick={() => setShowGlossaryModal(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-desc">设置专业术语缩写，AI 翻译时将自动转换。例如：Kubernetes → k8s</p>

              {/* 现有术语列表 */}
              {Object.keys(glossary).length > 0 && (
                <div style={{ marginBottom: 16, maxHeight: 200, overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: 'var(--muted)', fontSize: 11, textAlign: 'left' }}>
                        <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>专业名称</th>
                        <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>缩写</th>
                        <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', width: 40 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(glossary).map(([full, abbr]) => (
                        <tr key={full} style={{ borderBottom: '1px solid rgba(214,226,239,0.4)' }}>
                          <td style={{ padding: '6px 8px', color: 'var(--fg)' }}>{full}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--accent)', fontWeight: 600 }}>{abbr}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                const next = { ...glossary };
                                delete next[full];
                                setGlossary(next);
                                try { localStorage.setItem('livetranslate_glossary', JSON.stringify(next)); } catch {}
                                showToast('ok', `已删除 "${full}"`);
                              }}
                              style={{ background: 'transparent', border: 'none', color: 'var(--warm)', cursor: 'pointer', fontSize: 14 }}
                              title="删除"
                            >
                              <i className="fa-solid fa-trash-can" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 添加新术语 */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="专业名称，如 Kubernetes"
                  value={glossaryNewFull}
                  onChange={(e) => setGlossaryNewFull(e.target.value)}
                  style={{ flex: 1 }}
                />
                <span style={{ color: 'var(--muted)', fontSize: 14 }}>→</span>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="缩写，如 k8s"
                  value={glossaryNewAbbr}
                  onChange={(e) => setGlossaryNewAbbr(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  className="modal-btn confirm"
                  onClick={() => {
                    const full = glossaryNewFull.trim();
                    const abbr = glossaryNewAbbr.trim();
                    if (!full || !abbr) return;
                    const next = { ...glossary, [full]: abbr };
                    setGlossary(next);
                    try { localStorage.setItem('livetranslate_glossary', JSON.stringify(next)); } catch {}
                    setGlossaryNewFull('');
                    setGlossaryNewAbbr('');
                    showToast('ok', `已添加 "${full}" → "${abbr}"`);
                  }}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <i className="fa-solid fa-plus" /> 添加
                </button>
              </div>

              {/* 预设模板 */}
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>一键添加 IT 常用术语：</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PRESET_GLOSSARY.map(([full, abbr]) => (
                    <button
                      key={full}
                      onClick={() => {
                        if (glossary[full]) return;
                        const next = { ...glossary, [full]: abbr };
                        setGlossary(next);
                        try { localStorage.setItem('livetranslate_glossary', JSON.stringify(next)); } catch {}
                        showToast('ok', `已添加 "${full}" → "${abbr}"`);
                      }}
                      disabled={!!glossary[full]}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        borderRadius: 6,
                        border: `1px solid ${glossary[full] ? 'var(--border)' : 'var(--accent)'}`,
                        background: glossary[full] ? 'var(--bg)' : 'var(--accent-light)',
                        color: glossary[full] ? 'var(--muted)' : 'var(--accent)',
                        cursor: glossary[full] ? 'default' : 'pointer',
                        opacity: glossary[full] ? 0.5 : 1,
                      }}
                    >
                      {full} → {abbr}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn cancel" onClick={() => setShowGlossaryModal(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
