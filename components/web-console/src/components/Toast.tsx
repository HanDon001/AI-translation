import styles from '../styles/console.module.css';

export type ToastType = 'ok' | 'err' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  msg: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
}

const ICONS: Record<ToastType, string> = {
  ok: 'fa-circle-check',
  err: 'fa-circle-xmark',
  info: 'fa-circle-info',
};

export function ToastContainer({ toasts }: ToastContainerProps) {
  return (
    <div className={styles.toastContainer}>
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
          <i className={`fa-solid ${ICONS[t.type] || ICONS.info}`} />
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
