import { useCallback, useRef, useState } from 'react';
import type { ToastType } from '../components/Toast';

export interface ToastItem {
  id: number;
  type: ToastType;
  msg: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);

  const showToast = useCallback((type: ToastType, msg: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, type, msg }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  return { toasts, showToast };
}
