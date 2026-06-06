import { useCallback, useRef } from 'react';
import { DEMO_SENTENCES } from '../config/constants';
import type { ToastType } from '../components/Toast';
import { addConsoleLog } from './useConsoleLog';
import type { StepState } from './usePipelineSteps';

interface DemoCallbacks {
  setLiveSrc: (v: string) => void;
  setLiveTgt: (v: string) => void;
  setLiveLabel: (v: string) => void;
  addResult: (src: string, tgt: string | null, latency?: number) => void;
  showToast: (type: ToastType, msg: string) => void;
  handleStop: () => void;
  setStepState: (id: string, state: StepState, detail?: string, latency?: string) => void;
}

export function useDemoMode() {
  const isRunningRef = useRef(false);
  const demoIndexRef = useRef(0);

  const runDemoMode = useCallback(async (callbacks: DemoCallbacks) => {
    const { setLiveSrc, setLiveTgt, setLiveLabel, addResult, showToast, handleStop, setStepState } = callbacks;

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
      addConsoleLog('ok', `Sentence #${demoIndexRef.current} done, latency: ${totalLat}ms`);

      // 固化结果
      addResult(sent.src, sent.tgt, totalLat);

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
  }, []);

  const startDemo = useCallback((callbacks: DemoCallbacks) => {
    isRunningRef.current = true;
    runDemoMode(callbacks);
  }, [runDemoMode]);

  const stopDemo = useCallback(() => {
    isRunningRef.current = false;
  }, []);

  return { startDemo, stopDemo, isDemoRunningRef: isRunningRef };
}
