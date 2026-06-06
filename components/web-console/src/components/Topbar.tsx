import styles from '../styles/console.module.css';

interface TopbarProps {
  mode: 'mic' | 'tab';
  srcLang: string;
  tgtLang: string;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  onModeChange: (mode: 'mic' | 'tab') => void;
  onSrcLangChange: (v: string) => void;
  onTgtLangChange: (v: string) => void;
}

const STATUS_MAP = {
  disconnected: { text: '未连接', class: '' },
  connecting: { text: '连接中...', class: 'connecting' },
  connected: { text: '已连接', class: 'connected' },
  error: { text: '连接失败', class: 'error' },
};

export function Topbar({
  mode, srcLang, tgtLang, connectionStatus,
  onModeChange, onSrcLangChange, onTgtLangChange,
}: TopbarProps) {
  const status = STATUS_MAP[connectionStatus];

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarLeft}>
        <div className={styles.topbarLogo}>LT</div>
        <div className={styles.topbarTitle}>
          LiveTranslate Console
          <span>Qwen-LiveTranslate</span>
        </div>
      </div>

      <div className={styles.topbarCenter}>
        <div className={styles.modeSwitch}>
          <button className={`${styles.modeBtn} ${mode === 'mic' ? styles.active : ''}`} onClick={() => onModeChange('mic')}>
            <i className="fa-solid fa-microphone" /> 麦克风
          </button>
          <button className={`${styles.modeBtn} ${mode === 'tab' ? styles.active : ''}`} onClick={() => onModeChange('tab')}>
            <i className="fa-solid fa-desktop" /> 标签页
          </button>
        </div>

        <div className={styles.langGroup}>
          <select className={styles.langSelect} value={srcLang} onChange={(e) => onSrcLangChange(e.target.value)}>
            <option value="en-US">English</option>
            <option value="zh-CN">中文</option>
            <option value="ja-JP">日本語</option>
            <option value="ko-KR">한국어</option>
            <option value="fr-FR">Français</option>
            <option value="de-DE">Deutsch</option>
            <option value="es-ES">Español</option>
            <option value="ru-RU">Русский</option>
          </select>
          <span className={styles.langArrow}><i className="fa-solid fa-arrow-right" /></span>
          <select className={styles.langSelect} value={tgtLang} onChange={(e) => onTgtLangChange(e.target.value)}>
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

        <div className={`${styles.statusDot} ${status.class ? styles[status.class] : ''}`}>
          <div className={styles.dot} />
          <span>{status.text}</span>
        </div>
      </div>

      <div className={styles.topbarRight}>
        <a href="/landing.html" className={styles.topbarBack}>
          <i className="fa-solid fa-arrow-left" /> 返回官网
        </a>
      </div>
    </header>
  );
}
