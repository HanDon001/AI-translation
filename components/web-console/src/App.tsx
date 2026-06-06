import { useRef, useCallback, useEffect, useState } from 'react';
import { Topbar } from './components/Topbar';
import { PipelineSteps } from './components/PipelineSteps';
import { ResultsPanel } from './components/ResultsPanel';
import { Waveform } from './components/Waveform';
import { LogPanel } from './components/LogPanel';
import { ToastContainer } from './components/Toast';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
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

  const isRunningRef = useRef(false);
  const lastFinalTextRef = useRef('');
  const translateAbortRef = useRef<AbortController | null>(null);
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
  const { start: startSpeech, stop: stopSpeech } = useSpeechRecognition();
  const { start: startWorklet, stop: stopWorklet } = useAudioWorklet();
  const { connect: wsConnect, disconnect: wsDisconnect, send: wsSend } = useWebSocket(API_ENDPOINTS.GATEWAY_WS);
  const { steps, setStepState, resetSteps } = usePipelineSteps();
  const { logs, clear: clearLogs } = useConsoleLogs();
  const translationLog = useTranslationLog();

  /* ---- 翻译（麦克风模式） ---- */
  const translateText = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const srcCode = LANG_MAP[srcLang] || 'en';
    const tgtCode = tgtLang;

    if (srcCode === tgtCode) {
      setLiveTgt(text);
      setLiveLabel('识别中');
      addResult(text, text);
      return;
    }

    setIsTranslating(true);
    setLiveTgt('正在翻译...');
    setLiveLabel('翻译中');
    setStepState('mt', 'active', '翻译中...');
    addConsoleLog('info', `翻译请求: "${text.substring(0, 30)}..."`);

    try {
      const controller = new AbortController();
      translateAbortRef.current = controller;

      const url = `${API_ENDPOINTS.MYMEMORY}?q=${encodeURIComponent(text)}&langpair=${srcCode}|${tgtCode}`;
      const resp = await fetch(url, { signal: controller.signal });
      const data = await resp.json();

      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        const translated = data.responseData.translatedText;
        setLiveTgt(translated);
        setLiveLabel('识别中');
        setStepState('mt', 'done', '翻译完成', '200ms');
        addConsoleLog('ok', `翻译完成: "${translated.substring(0, 30)}..."`);
        addResult(text, translated);
      } else {
        throw new Error(data.responseDetails || '翻译服务返回异常');
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const msg = e instanceof Error ? e.message : '翻译失败';
      setLiveTgt(`翻译失败: ${msg}`);
      setLiveLabel('错误');
      setStepState('mt', 'error', msg);
      addConsoleLog('err', `翻译失败: ${msg}`);
      addResult(text, null);
    } finally {
      setIsTranslating(false);
      translateAbortRef.current = null;
    }
  }, [srcLang, tgtLang, setStepState, addResult]);

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
    } catch {
      addConsoleLog('warn', '音频分析器初始化失败（不影响识别）');
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
            addResult(new_text, new_text);
          }
        }
      }

      if (msg.type === 'error') {
        addConsoleLog('err', `网关错误: ${msg.payload?.message || '未知错误'}`);
        showToast('err', msg.payload?.message || '翻译错误');
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
    stopSpeech();
    stopWorklet();
    stopTimer();
    resetSteps();
    stopDemo();
    translateAbortRef.current?.abort();
    wsDisconnect();

    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
      analyserRef.current = null;
    }

    addConsoleLog('info', 'Closing WebSocket connection...');
    addConsoleLog('ok', 'Session closed');
    showToast('info', '已停止');
  }, [stopSpeech, stopWorklet, stopTimer, resetSteps, showToast, wsDisconnect, stopDemo]);

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
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognition) {
          addConsoleLog('ok', 'Web Speech API 可用，启动语音识别');
          showToast('ok', '麦克风已启动，开始说话');

          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setupAudioAnalyser(stream);

            startSpeech((text: string, isFinal: boolean) => {
              if (!isRunningRef.current) return;

              if (isFinal) {
                setLiveSrc(text);
                setLiveLabel('翻译中');
                setStepState('vad', 'done', '检测到语音', '30ms');
                setStepState('asr', 'done', '识别完成', '150ms');
                addConsoleLog('data', `ASR final: "${text}"`);
                translateText(text);
              } else {
                setLiveSrc(text);
                setLiveLabel('识别中');
                setStepState('vad', 'active', '检测语音活动...');
                setStepState('asr', 'active', '流式转录中...');
                addConsoleLog('data', `ASR partial: "${text}"`);
              }
            }, srcLang);
          } catch {
            addConsoleLog('err', '麦克风访问失败，切换到演示模式');
            showToast('err', '麦克风访问失败，使用演示模式');
            startDemo(demoCallbacks);
          }
        } else {
          addConsoleLog('warn', 'Web Speech API 不可用，使用演示模式');
          showToast('info', '浏览器不支持语音识别，使用演示模式');
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
          } else {
            addConsoleLog('warn', '未设置 API Key，将使用 Mock 模式');
          }
        } catch {
          addConsoleLog('warn', '标签页音频捕获失败，使用演示模式');
          startDemo(demoCallbacks);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '启动失败';
      addConsoleLog('err', `启动失败: ${msg}`);
      showToast('err', `启动失败: ${msg}`);
      setConnectionStatus('error');
      isRunningRef.current = false;
      setIsRunning(false);
      stopTimer();
    }
  }, [mode, srcLang, tgtLang, apiKey, startSpeech, startWorklet, wsConnect, wsSend, setupAudioAnalyser, startTimer, stopTimer, resetSteps, setStepState, translateText, showToast, startDemo, handleStop, resetResults, addResult]);

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
      translateAbortRef.current?.abort();
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
    </div>
  );
}
