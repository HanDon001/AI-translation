import { useCallback, useEffect, useRef, useState } from 'react';

export function useFloatWindow() {
  const [showFloatWindow, setShowFloatWindow] = useState(false);
  const floatWindowRef = useRef<Window | null>(null);

  const openFloatWindow = useCallback((showToast: (type: string, msg: string) => void) => {
    if (floatWindowRef.current && !floatWindowRef.current.closed) {
      floatWindowRef.current.focus();
      return;
    }

    const width = 700;
    const height = 120;
    const left = Math.round((window.screen.width - width) / 2);
    const top = window.screen.height - height - 80;

    const win = window.open(
      '/desktop-lyrics.html',
      'DesktopSubtitles',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=no,status=no,menubar=no,toolbar=no`
    );

    if (!win) {
      showToast('err', '无法打开弹窗，请允许弹窗权限');
      return;
    }

    floatWindowRef.current = win;
    setShowFloatWindow(true);

    const checkClosed = setInterval(() => {
      if (win.closed) {
        clearInterval(checkClosed);
        setShowFloatWindow(false);
        floatWindowRef.current = null;
      }
    }, 500);

    showToast('ok', '桌面字幕已打开');
  }, []);

  // 更新浮窗内容
  const updateFloatWindow = useCallback((src: string, tgt: string, isRunning: boolean) => {
    if (!floatWindowRef.current || floatWindowRef.current.closed) return;
    floatWindowRef.current.postMessage({ type: 'update', src, tgt, isRunning }, '*');
  }, []);

  // 监听弹窗关闭消息
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

  return { showFloatWindow, openFloatWindow, updateFloatWindow };
}
