import { useEffect, useRef } from 'react';

interface WaveformProps {
  isActive: boolean;
  analyser?: AnalyserNode | null;
  waveData?: Float32Array;
}

export function Waveform({ isActive, analyser, waveData }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<Float32Array>(waveData || new Float32Array(128));
  const animRef = useRef<number>(0);

  // 更新 waveData 引用
  useEffect(() => {
    if (waveData) dataRef.current = waveData;
  }, [waveData]);

  // 绘制波形
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.width / devicePixelRatio;
      const h = canvas.height / devicePixelRatio;
      const data = dataRef.current;
      ctx.clearRect(0, 0, w, h);

      const barW = Math.max(2, w / data.length - 1.5);
      const gap = 1.5;
      const midY = h / 2;

      for (let i = 0; i < data.length; i++) {
        const x = i * (barW + gap);
        const amp = data[i] * (h * 0.38);
        const intensity = Math.abs(data[i]);

        // 蓝色系渐变
        const r = Math.round(2 + intensity * 6);
        const g = Math.round(119 + intensity * 40);
        const b = Math.round(189 + intensity * 30);
        const alpha = 0.2 + intensity * 0.65;

        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x, midY - amp, barW, Math.max(1, amp * 2), 1.5);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // 更新波形数据
  useEffect(() => {
    const data = dataRef.current;
    let raf: number;

    if (isActive && analyser) {
      // 真实音频数据
      const bufferLength = analyser.fftSize;
      const dataArray = new Float32Array(bufferLength);

      const update = () => {
        analyser.getFloatTimeDomainData(dataArray);

        // 降采样到 128
        const step = Math.floor(bufferLength / data.length);
        for (let i = 0; i < data.length; i++) {
          const target = dataArray[i * step] || 0;
          data[i] += (target - data[i]) * 0.2;
        }

        raf = requestAnimationFrame(update);
      };
      raf = requestAnimationFrame(update);
    } else if (isActive) {
      // 模拟动画
      const update = () => {
        for (let i = 0; i < data.length; i++) {
          const target =
            Math.sin(Date.now() * 0.003 + i * 0.3) * 0.3 +
            Math.sin(Date.now() * 0.007 + i * 0.5) * 0.2 +
            Math.random() * 0.3;
          data[i] += (target - data[i]) * 0.15;
        }
        raf = requestAnimationFrame(update);
      };
      raf = requestAnimationFrame(update);
    } else {
      // 衰减
      const decay = () => {
        let allZero = true;
        for (let i = 0; i < data.length; i++) {
          data[i] *= 0.88;
          if (Math.abs(data[i]) > 0.001) allZero = false;
          else data[i] = 0;
        }
        if (!allZero) raf = requestAnimationFrame(decay);
      };
      raf = requestAnimationFrame(decay);
    }

    return () => cancelAnimationFrame(raf);
  }, [isActive, analyser]);

  return (
    <div className="waveform-wrap">
      <canvas ref={canvasRef} />
      <div className={`waveform-label ${isActive ? 'active' : ''}`}>
        <div className="live-dot" />
        <span>{isActive ? 'LIVE · 16000 Hz · PCM16' : 'IDLE · 0 Hz'}</span>
      </div>
    </div>
  );
}
