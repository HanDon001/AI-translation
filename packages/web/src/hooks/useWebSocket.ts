import { useRef, useState, useCallback, useEffect } from 'react';

interface WsState {
  isConnected: boolean;
  error: string | null;
}

export function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<WsState>({ isConnected: false, error: null });

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setState({ isConnected: true, error: null });
        console.log('[WS] Connected to', url);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          // 事件分发到对应的 handler
          window.dispatchEvent(new CustomEvent('ws:message', { detail: msg }));
        } catch {
          console.warn('[WS] Failed to parse message:', event.data);
        }
      };

      ws.onclose = () => {
        setState({ isConnected: false, error: null });
        console.log('[WS] Disconnected');
      };

      ws.onerror = () => {
        setState((prev) => ({ ...prev, error: 'WebSocket 连接失败' }));
      };
    } catch (err) {
      setState({ isConnected: false, error: String(err) });
    }
  }, [url]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { ...state, connect, disconnect, send, ws: wsRef };
}
