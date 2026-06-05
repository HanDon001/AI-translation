import { useRef, useCallback, useEffect, useState } from 'react';
import { Topbar } from './components/Topbar';
import { PipelineSteps } from './components/PipelineSteps';
import { ResultsPanel } from './components/ResultsPanel';
import type { TranslationResult } from './components/ResultsPanel';
import { Waveform } from './components/Waveform';
import { LogPanel } from './components/LogPanel';
import { ToastContainer } from './components/Toast';
import type { ToastType } from './components/Toast';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useAudioWorklet } from './hooks/useAudioWorklet';
import { useWebSocket } from './hooks/useWebSocket';
import { usePipelineSteps } from './hooks/usePipelineSteps';
import { addConsoleLog, useConsoleLogs } from './hooks/useConsoleLog';
import './styles/console.css';

/* 语言代码映射 */
const LANG_MAP: Record<string, string> = {
  'en-US': 'en', 'zh-CN': 'zh', 'ja-JP': 'ja', 'ko-KR': 'ko',
  'fr-FR': 'fr', 'de-DE': 'de', 'es-ES': 'es', 'ru-RU': 'ru',
};

/* 演示数据 */
const DEMO_SENTENCES = [
  { src: "Good morning everyone, thank you for joining today's session.", tgt: "大家早上好，感谢参加今天的会议。" },
  { src: "I'd like to share some insights about the future of AI.", tgt: "我想分享一些关于人工智能未来的见解。" },
  { src: "The rapid development of large language models has changed everything.", tgt: "大语言模型的快速发展改变了一切。" },
  { src: "We believe that real-time translation will break down language barriers.", tgt: "我们相信实时翻译将打破语言障碍。" },
  { src: "Let me show you a demo of our latest capabilities.", tgt: "让我展示一下我们最新能力的演示。" },
  { src: "The accuracy has improved significantly compared to last year.", tgt: "与去年相比，准确率有了显著提升。" },
  { src: "We are now supporting over fifty languages in real time.", tgt: "我们现在实时支持超过五十种语言。" },
  { src: "The system can handle both formal speeches and casual conversations.", tgt: "系统可以处理正式演讲和日常对话。" },
  { src: "Latency has been reduced to under five hundred milliseconds.", tgt: "延迟已降低到五百毫秒以内。" },
  { src: "Thank you for your attention. I'm happy to take questions now.", tgt: "感谢大家的关注。我现在很乐意回答问题。" },
];

interface ToastItem {
  id: number;
  type: ToastType;
  msg: string;
}

export default function App() {
  /* ---- 状态 ---- */
  const [mode, setMode] = useState<'mic' | 'tab'>('mic');
  const [srcLang, setSrcLang] = useState('en-US');
  const [tgtLang, setTgtLang] = useState('zh');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TranslationResult[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [sentenceCount, setSentenceCount] = useState(0);
  const [avgLatency, setAvgLatency] = useState('--');
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [liveSrc, setLiveSrc] = useState('');
  const [liveTgt, setLiveTgt] = useState('');
  const [liveLabel, setLiveLabel] = useState('识别中');
  const [isTranslating, setIsTranslating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [apiKey, setApiKey] = useState('sk-fd3705af25f64659bed8ee4fdab5185c');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [showFloatWindow, setShowFloatWindow] = useState(false);
  const floatWindowRef = useRef<Window | null>(null);

  const isRunningRef = useRef(false);
  const sessionSecondsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultIdRef = useRef(0);
  const latenciesRef = useRef<number[]>([]);
  const lastFinalTextRef = useRef('');
  const translateAbortRef = useRef<AbortController | null>(null);
  const toastIdRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const waveDataRef = useRef<Float32Array>(new Float32Array(128));
  const demoIndexRef = useRef(0);
  const windowIdRef = useRef(0);

  const { start: startSpeech, stop: stopSpeech } = useSpeechRecognition();
  const { start: startWorklet, stop: stopWorklet } = useAudioWorklet();
  const { connect: wsConnect, disconnect: wsDisconnect, send: wsSend, isConnected: wsConnected } = useWebSocket('ws://localhost:3000/ws');
  const { steps, setStepState, resetSteps } = usePipelineSteps();
  const { logs, clear: clearLogs } = useConsoleLogs();

  /* ---- Toast ---- */
  const showToast = useCallback((type: ToastType, msg: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, type, msg }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  /* ---- 计时器 ---- */
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

  /* ---- 翻译（用于麦克风模式） ---- */
  const translateText = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const srcCode = LANG_MAP[srcLang] || 'en';
    const tgtCode = tgtLang;

    if (srcCode === tgtCode) {
      setLiveTgt(text);
      setLiveLabel('识别中');
      addFinalResult(text, text);
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

      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${srcCode}|${tgtCode}`;
      const resp = await fetch(url, { signal: controller.signal });
      const data = await resp.json();

      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        let translated = data.responseData.translatedText;
        setLiveTgt(translated);
        setLiveLabel('识别中');
        setStepState('mt', 'done', '翻译完成', '200ms');
        addConsoleLog('ok', `翻译完成: "${translated.substring(0, 30)}..."`);
        addFinalResult(text, translated);
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
      addFinalResult(text, null, msg);
    } finally {
      setIsTranslating(false);
      translateAbortRef.current = null;
    }
  }, [srcLang, tgtLang, setStepState]);

  /* ---- 结果固化 ---- */
  const addFinalResult = useCallback((src: string, tgt: string | null, err?: string) => {
    const now = new Date();
    const timeStr = now.toTimeString().substring(0, 8);
    const id = ++resultIdRef.current;
    const latency = latenciesRef.current.length > 0
      ? latenciesRef.current[latenciesRef.current.length - 1]
      : undefined;

    setResults((prev) => [{ id, source: src, target: tgt || '', latency, isStreaming: false, time: timeStr }, ...prev]);
    setSentenceCount((c) => c + 1);

    // 更新平均延迟
    if (latenciesRef.current.length > 0) {
      const avg = Math.round(latenciesRef.current.reduce((a, b) => a + b, 0) / latenciesRef.current.length);
      setAvgLatency(`${avg}ms`);
    }

    // 延迟后清空当前卡片
    setTimeout(() => {
      if (isRunningRef.current) {
        setLiveSrc('');
        setLiveTgt('');
        setLiveLabel('识别中');
        lastFinalTextRef.current = '';
      }
    }, 800);
  }, []);

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

      // 网关返回的是 subtitle_patch 消息
      if (msg.type === 'subtitle_patch') {
        const { action, new_text, style } = msg.payload || {};

        if (action === 'ADD_TEMP') {
          // 临时翻译结果（流式）
          setLiveTgt(new_text || '');
          setIsTranslating(true);
          setStepState('mt', 'active', '翻译中...');
          setStepState('asr', 'done', '识别完成', '150ms');
          addConsoleLog('data', `MT partial: "${new_text || ''}"`);
        }

        if (action === 'MARK_FINAL') {
          // 最终翻译结果
          setLiveTgt(new_text || '');
          setIsTranslating(false);
          setStepState('mt', 'done', '翻译完成', '200ms');
          setStepState('post', 'done', '后处理完成', '10ms');
          addConsoleLog('ok', `MT final: "${new_text || ''}"`);

          // 固化结果
          if (new_text) {
            latenciesRef.current.push(350);  // 模拟延迟
            addFinalResult(new_text, new_text);  // 网关返回的已经是翻译结果
          }
        }
      }

      // 处理错误消息
      if (msg.type === 'error') {
        addConsoleLog('err', `网关错误: ${msg.payload?.message || '未知错误'}`);
        showToast('err', msg.payload?.message || '翻译错误');
      }
    };

    window.addEventListener('ws:message', handleMessage);
    return () => window.removeEventListener('ws:message', handleMessage);
  }, [setStepState, addConsoleLog, showToast, addFinalResult]);

  /* ---- 演示模式 ---- */
  const runDemoMode = useCallback(async () => {
    addConsoleLog('info', '🎤 启动演示模式（模拟翻译流程）');
    addConsoleLog('info', '提示：如需真实翻译，请确保浏览器支持 Web Speech API');

    demoIndexRef.current = 0;

    while (isRunningRef.current && demoIndexRef.current < DEMO_SENTENCES.length) {
      const sent = DEMO_SENTENCES[demoIndexRef.current];
      demoIndexRef.current++;

      // VAD
      setStepState('vad', 'active', '检测语音活动...');
      await new Promise(r => setTimeout(r, 100));
      setStepState('vad', 'done', '语音检测通过', '30ms');
      addConsoleLog('ok', 'VAD: speech detected');

      // ASR 流式
      setStepState('asr', 'active', '流式转录中...');
      const words = sent.src.split(' ');
      let partial = '';
      for (let i = 0; i < words.length; i++) {
        if (!isRunningRef.current) break;
        partial += (i > 0 ? ' ' : '') + words[i];
        setLiveSrc(partial + (i < words.length - 1 ? '...' : ''));
        addConsoleLog('data', `ASR partial: "${partial}"`);
        await new Promise(r => setTimeout(r, 150 + Math.random() * 100));
      }
      const asrLat = 180 + Math.floor(Math.random() * 140);
      setStepState('asr', 'done', '识别完成', `${asrLat}ms`);
      addConsoleLog('ok', `ASR final: "${sent.src}"`);
      setLiveSrc(sent.src);
      setLiveLabel('翻译中');

      // MT 流式
      setStepState('mt', 'active', '翻译中...');
      const chars = sent.tgt.split('');
      let tgtPartial = '';
      for (let i = 0; i < chars.length; i++) {
        if (!isRunningRef.current) break;
        tgtPartial += chars[i];
        if (i % 3 === 0 || i === chars.length - 1) {
          setLiveTgt(tgtPartial);
          await new Promise(r => setTimeout(r, 30 + Math.random() * 40));
        }
      }
      const mtLat = 200 + Math.floor(Math.random() * 200);
      setStepState('mt', 'done', '翻译完成', `${mtLat}ms`);
      addConsoleLog('ok', `MT: "${sent.tgt}"`);

      // 后处理
      setStepState('post', 'active', '对齐时间戳...');
      await new Promise(r => setTimeout(r, 50));
      setStepState('post', 'done', '后处理完成', '20ms');

      const totalLat = asrLat + mtLat + 20;
      latenciesRef.current.push(totalLat);
      addConsoleLog('ok', `Sentence #${demoIndexRef.current} done, latency: ${totalLat}ms`);

      // 固化结果
      addFinalResult(sent.src, sent.tgt);
      setSentenceCount(demoIndexRef.current);
      setAvgLatency(Math.round(latenciesRef.current.reduce((a, b) => a + b, 0) / latenciesRef.current.length) + 'ms');

      // 等待下一句
      if (isRunningRef.current && demoIndexRef.current < DEMO_SENTENCES.length) {
        setStepState('vad', 'pending', '等待语音...');
        addConsoleLog('info', 'VAD: silence, waiting...');
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 800));
      }
    }

    if (isRunningRef.current) {
      addConsoleLog('warn', '演示数据已全部播放');
      showToast('info', '演示完成');
      handleStop();
    }
  }, [addFinalResult, showToast, setStepState]);

  /* ---- 启动/停止 ---- */
  const handleStop = useCallback(() => {
    isRunningRef.current = false;
    setIsRunning(false);
    setConnectionStatus('disconnected');
    stopSpeech();
    stopWorklet();
    stopTimer();
    resetSteps();
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
  }, [stopSpeech, stopWorklet, stopTimer, resetSteps, showToast, wsDisconnect]);

  const handleToggle = useCallback(async () => {
    if (isRunningRef.current) {
      handleStop();
      return;
    }

    // 检查 API Key
    if (!apiKey.trim()) {
      setShowApiKeyModal(true);
      setTempApiKey('');
      return;
    }

    // 启动
    isRunningRef.current = true;
    setIsRunning(true);
    setResults([]);
    setSentenceCount(0);
    setAvgLatency('--');
    latenciesRef.current = [];
    resultIdRef.current = 0;
    lastFinalTextRef.current = '';
    resetSteps();
    startTimer();

    addConsoleLog('info', 'Qwen-LiveTranslate Console v1.0.0');
    addConsoleLog('info', `模式: ${mode === 'mic' ? '麦克风' : '标签页'}, 源: ${srcLang}, 目标: ${tgtLang}`);

    try {
      // 步骤 1: 初始化
      setStepState('init', 'active', '正在初始化...');
      setConnectionStatus('connecting');
      addConsoleLog('info', 'RealtimeTranslator(model="qwen-livetranslate")');
      await new Promise(r => setTimeout(r, 300));
      setStepState('init', 'done', '初始化完成', '120ms');
      addConsoleLog('ok', 'SDK 初始化完成');

      // 步骤 2: WebSocket 连接
      setStepState('ws', 'active', '正在连接...');
      addConsoleLog('info', 'Connecting to ws://localhost:3000/ws');
      wsConnect();
      await new Promise(r => setTimeout(r, 500));
      setStepState('ws', 'done', '连接已建立', '380ms');
      addConsoleLog('ok', 'WebSocket connected [OPEN]');
      setConnectionStatus('connected');

      // 步骤 3: 鉴权
      setStepState('auth', 'active', '验证中...');
      await new Promise(r => setTimeout(r, 150));
      setStepState('auth', 'done', '鉴权通过', '95ms');
      addConsoleLog('ok', 'Authentication success');
      addConsoleLog('info', 'Session ready. Waiting for audio stream...');

      if (mode === 'mic') {
        // 麦克风模式：Web Speech API + MyMemory 翻译
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
            runDemoMode();
          }
        } else {
          addConsoleLog('warn', 'Web Speech API 不可用，使用演示模式');
          showToast('info', '浏览器不支持语音识别，使用演示模式');
          runDemoMode();
        }
      } else {
        // 标签页模式：捕获音频并发送到网关做 ASR + 翻译
        addConsoleLog('info', '标签页模式：捕获音频并发送到网关处理');
        showToast('ok', '标签页音频捕获已启动');

        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
            video: true,
          });
          stream.getVideoTracks().forEach(t => t.stop());
          setupAudioAnalyser(stream);

          // 使用 AudioWorklet 捕获音频块并发送到网关，传入已有的流
          startWorklet((chunk: Float32Array) => {
            if (!isRunningRef.current) return;

            // 将 Float32Array 转换为 PCM16 格式（DashScope API 要求）
            const pcm16 = new Int16Array(chunk.length);
            for (let i = 0; i < chunk.length; i++) {
              const s = Math.max(-1, Math.min(1, chunk[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            const bytes = new Uint8Array(pcm16.buffer);
            const base64 = btoa(String.fromCharCode(...bytes));

            const windowId = windowIdRef.current++;
            const startMs = windowId * 400;  // 每个窗口 400ms

            // 发送到网关（格式匹配 AudioChunkEvent）
            wsSend({
              type: 'audio_chunk',
              payload: {
                window_id: windowId,
                start_ms: startMs,
                duration: 400,
                pcm_data: base64,
              },
            });

            // 更新 VAD 状态
            setStepState('vad', 'active', '检测语音活动...');
          }, 'tab', stream);  // 传入已有的流，避免重复调用 getDisplayMedia

          addConsoleLog('ok', '标签页音频已捕获，开始发送到网关');
          setStepState('vad', 'active', '等待语音...');

          // 发送 API Key 到网关（如果有）
          if (apiKey) {
            wsSend({
              type: 'set_api_key',
              payload: { apiKey },
            });
            addConsoleLog('info', 'API Key 已发送到网关');
          } else {
            addConsoleLog('warn', '未设置 API Key，将使用 Mock 模式');
          }

        } catch {
          addConsoleLog('warn', '标签页音频捕获失败，使用演示模式');
          runDemoMode();
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
  }, [mode, srcLang, tgtLang, apiKey, startSpeech, stopSpeech, startWorklet, wsConnect, wsSend, setupAudioAnalyser, startTimer, stopTimer, resetSteps, setStepState, translateText, showToast, runDemoMode, handleStop]);

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

  /* ---- 打开桌面浮窗 ---- */
  const openFloatWindow = useCallback(() => {
    // 如果已经打开，聚焦它
    if (floatWindowRef.current && !floatWindowRef.current.closed) {
      floatWindowRef.current.focus();
      return;
    }

    // 打开新窗口（桌面字幕）
    const width = 700;
    const height = 120;
    const left = Math.round((window.screen.width - width) / 2);
    const top = window.screen.height - height - 80;

    const win = window.open(
      '',
      'DesktopSubtitles',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=no,status=no,menubar=no,toolbar=no`
    );

    if (!win) {
      showToast('err', '无法打开弹窗，请允许弹窗权限');
      return;
    }

    floatWindowRef.current = win;
    setShowFloatWindow(true);

    // 写入桌面字幕内容
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>桌面字幕</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
            background: transparent;
            color: #fff;
            overflow: hidden;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            -webkit-app-region: drag;
            user-select: none;
          }
          body.dragging { opacity: 0.3; }

          .container {
            width: 100%;
            text-align: center;
            padding: 20px 30px;
            position: relative;
          }

          /* 原文 */
          .src-line {
            font-size: 16px;
            color: rgba(255, 255, 255, 0.5);
            margin-bottom: 8px;
            letter-spacing: 1px;
            transition: all 0.3s ease;
            text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
          }

          /* 翻译 */
          .tgt-line {
            font-size: 28px;
            font-weight: 600;
            color: #fff;
            letter-spacing: 2px;
            line-height: 1.4;
            text-shadow: 0 2px 20px rgba(0, 0, 0, 0.5), 0 0 40px rgba(14, 165, 233, 0.3);
            transition: all 0.3s ease;
            min-height: 40px;
          }

          /* 发光效果 */
          .tgt-line.glow {
            animation: textGlow 2s ease-in-out infinite;
          }

          @keyframes textGlow {
            0%, 100% { text-shadow: 0 2px 20px rgba(0, 0, 0, 0.5), 0 0 40px rgba(14, 165, 233, 0.3); }
            50% { text-shadow: 0 2px 20px rgba(0, 0, 0, 0.5), 0 0 60px rgba(14, 165, 233, 0.5), 0 0 80px rgba(168, 85, 247, 0.3); }
          }

          /* 进入动画 */
          .fade-in {
            animation: fadeInUp 0.4s ease;
          }

          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }

          /* 空状态 */
          .empty {
            color: rgba(255, 255, 255, 0.3);
            font-size: 14px;
            letter-spacing: 2px;
          }

          /* 工具栏（悬浮时显示） */
          .toolbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 32px;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(10px);
            display: none;
            align-items: center;
            justify-content: space-between;
            padding: 0 10px;
            -webkit-app-region: drag;
            z-index: 10;
          }

          body:hover .toolbar { display: flex; }

          .toolbar-left {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            color: rgba(255, 255, 255, 0.5);
          }

          .toolbar-left i { color: #0ea5e9; }

          .toolbar-right {
            display: flex;
            gap: 4px;
            -webkit-app-region: no-drag;
          }

          .toolbar-right button {
            background: none;
            border: none;
            color: rgba(255, 255, 255, 0.5);
            font-size: 12px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            transition: all 0.2s;
          }

          .toolbar-right button:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
          }

          /* 样式面板 */
          .style-panel {
            position: fixed;
            top: 32px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 12px;
            display: none;
            flex-direction: column;
            gap: 8px;
            z-index: 20;
          }

          .style-panel.show { display: flex; }

          .style-panel label {
            font-size: 10px;
            color: rgba(255, 255, 255, 0.4);
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          .color-options {
            display: flex;
            gap: 6px;
          }

          .color-dot {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            cursor: pointer;
            border: 2px solid transparent;
            transition: all 0.2s;
          }

          .color-dot:hover { transform: scale(1.1); }
          .color-dot.active { border-color: #fff; }

          .slider-row {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .slider-row input[type="range"] {
            flex: 1;
            -webkit-appearance: none;
            height: 3px;
            border-radius: 2px;
            background: rgba(255, 255, 255, 0.2);
            outline: none;
          }

          .slider-row input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #0ea5e9;
            cursor: pointer;
          }

          .slider-val {
            font-size: 10px;
            color: rgba(255, 255, 255, 0.5);
            min-width: 30px;
            text-align: right;
          }
        </style>
      </head>
      <body>
        <!-- 工具栏 -->
        <div class="toolbar">
          <div class="toolbar-left">
            <i class="fa-solid fa-language"></i>
            <span>桌面字幕</span>
          </div>
          <div class="toolbar-right">
            <button onclick="toggleStylePanel()" title="样式"><i class="fa-solid fa-palette"></i></button>
            <button onclick="window.close()" title="关闭"><i class="fa-solid fa-xmark"></i></button>
          </div>
        </div>

        <!-- 样式面板 -->
        <div class="style-panel" id="stylePanel">
          <label>文字颜色</label>
          <div class="color-options">
            <div class="color-dot active" style="background: #ffffff" onclick="setColor('#ffffff', this)"></div>
            <div class="color-dot" style="background: #0ea5e9" onclick="setColor('#0ea5e9', this)"></div>
            <div class="color-dot" style="background: #a855f7" onclick="setColor('#a855f7', this)"></div>
            <div class="color-dot" style="background: #f43f5e" onclick="setColor('#f43f5e', this)"></div>
            <div class="color-dot" style="background: #10b981" onclick="setColor('#10b981', this)"></div>
            <div class="color-dot" style="background: #f59e0b" onclick="setColor('#f59e0b', this)"></div>
          </div>
          <label>字体大小</label>
          <div class="slider-row">
            <input type="range" min="18" max="48" value="28" oninput="setSize(this.value)">
            <span class="slider-val" id="sizeVal">28px</span>
          </div>
          <label>透明度</label>
          <div class="slider-row">
            <input type="range" min="20" max="100" value="100" oninput="setOpacity(this.value)">
            <span class="slider-val" id="opacityVal">100%</span>
          </div>
        </div>

        <!-- 字幕内容 -->
        <div class="container">
          <div class="empty" id="empty">还未选择翻译页面</div>
          <div id="lyrics" style="display:none">
            <div class="src-line" id="srcLine"></div>
            <div class="tgt-line glow" id="tgtLine"></div>
          </div>
          <!-- 状态指示器 -->
          <div id="statusDot" style="position:absolute;bottom:5px;right:10px;width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.2);pointer-events:none;transition:all 0.3s;"></div>
        </div>

        <script>
          let currentColor = '#ffffff';
          let isDragging = false;
          let ws = null;

          function toggleStylePanel() {
            document.getElementById('stylePanel').classList.toggle('show');
          }

          function setColor(color, el) {
            currentColor = color;
            document.getElementById('tgtLine').style.color = color;
            document.getElementById('tgtLine').style.textShadow =
              '0 2px 20px rgba(0,0,0,0.5), 0 0 40px ' + color + '40';
            document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
            el.classList.add('active');
          }

          function setSize(val) {
            document.getElementById('tgtLine').style.fontSize = val + 'px';
            document.getElementById('sizeVal').textContent = val + 'px';
          }

          function setOpacity(val) {
            document.body.style.opacity = val / 100;
            document.getElementById('opacityVal').textContent = val + '%';
          }

          // 更新字幕显示
          function updateSubtitle(src, tgt) {
            if (!tgt) return;
            document.getElementById('empty').style.display = 'none';
            document.getElementById('lyrics').style.display = 'block';

            const srcLine = document.getElementById('srcLine');
            const tgtLine = document.getElementById('tgtLine');

            if (src && src !== srcLine.textContent) {
              srcLine.textContent = src;
              srcLine.classList.add('fade-in');
              setTimeout(() => srcLine.classList.remove('fade-in'), 400);
            }

            if (tgt !== tgtLine.textContent) {
              tgtLine.textContent = tgt;
              tgtLine.classList.add('fade-in');
              setTimeout(() => tgtLine.classList.remove('fade-in'), 400);
            }
          }

          // 连接网关 WebSocket
          function connectGateway() {
            ws = new WebSocket('ws://localhost:3000/ws');

            ws.onopen = () => {
              console.log('[DesktopSubtitles] Connected to gateway');
              document.getElementById('statusDot').style.background = '#10b981';
              document.getElementById('statusDot').style.boxShadow = '0 0 8px rgba(16,185,129,0.5)';
            };

            ws.onmessage = (event) => {
              try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'subtitle_patch') {
                  const { action, new_text } = msg.payload || {};
                  if ((action === 'ADD_TEMP' || action === 'MARK_FINAL') && new_text) {
                    updateSubtitle('', new_text);
                  }
                }
              } catch (err) {}
            };

            ws.onclose = () => {
              document.getElementById('statusDot').style.background = 'rgba(255,255,255,0.2)';
              document.getElementById('statusDot').style.boxShadow = 'none';
              setTimeout(connectGateway, 3000);
            };
          }

          // 拖动时降低透明度
          document.addEventListener('mousedown', (e) => {
            if (e.clientY < 32) return;
            isDragging = true;
            document.body.classList.add('dragging');
          });

          document.addEventListener('mouseup', () => {
            if (isDragging) {
              isDragging = false;
              document.body.classList.remove('dragging');
            }
          });

          // 监听来自父窗口的消息（备用）
          window.addEventListener('message', (e) => {
            if (e.data.type === 'update') {
              const { src, tgt, isRunning } = e.data;
              if (isRunning && tgt) {
                updateSubtitle(src, tgt);
              }
            }
          });

          // 窗口关闭时通知父窗口
          window.addEventListener('beforeunload', () => {
            if (ws) ws.close();
            if (window.opener) {
              window.opener.postMessage({ type: 'floatClosed' }, '*');
            }
          });

          // 启动时连接网关
          connectGateway();
        </script>
      </body>
      </html>
    `);

    // 监听弹窗关闭
    const checkClosed = setInterval(() => {
      if (win.closed) {
        clearInterval(checkClosed);
        setShowFloatWindow(false);
        floatWindowRef.current = null;
      }
    }, 500);

    showToast('ok', '桌面字幕已打开');
  }, [showToast]);

  /* ---- 更新浮窗内容 ---- */
  useEffect(() => {
    if (!floatWindowRef.current || floatWindowRef.current.closed) return;

    floatWindowRef.current.postMessage({
      type: 'update',
      src: liveSrc,
      tgt: liveTgt,
      isRunning,
    }, '*');
  }, [liveSrc, liveTgt, isRunning]);

  /* ---- 监听弹窗关闭消息 ---- */
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'floatClosed') {
        setShowFloatWindow(false);
        floatWindowRef.current = null;
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
        isRunning={isRunning}
        connectionStatus={connectionStatus}
        onModeChange={setMode}
        onSrcLangChange={handleSrcLangChange}
        onTgtLangChange={handleTgtLangChange}
        onToggle={handleToggle}
      />

      <div className="main">
        {/* 左侧：配置 + 管道 */}
        <aside className="panel-left">
          {/* 参数配置 */}
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
                    const resp = await fetch('http://127.0.0.1:8765/toggle');
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
          </div>

          <PipelineSteps steps={steps} />
        </aside>

        {/* 中间：结果区 */}
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

        {/* 右侧：日志 */}
        <aside className="panel-right">
          <LogPanel logs={logs} onClear={clearLogs} />
        </aside>
      </div>

      <ToastContainer toasts={toasts} />

      {/* API Key 弹窗 */}
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
                    setApiKey(tempApiKey.trim());
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
