interface TopbarProps {
  mode: 'mic' | 'tab';
  srcLang: string;
  tgtLang: string;
  isRunning: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  onModeChange: (mode: 'mic' | 'tab') => void;
  onSrcLangChange: (v: string) => void;
  onTgtLangChange: (v: string) => void;
  onToggle: () => void;
}

const STATUS_MAP = {
  disconnected: { text: '未连接', class: '' },
  connecting: { text: '连接中...', class: 'connecting' },
  connected: { text: '已连接', class: 'connected' },
  error: { text: '连接失败', class: 'error' },
};

export function Topbar({
  mode, srcLang, tgtLang, isRunning, connectionStatus,
  onModeChange, onSrcLangChange, onTgtLangChange, onToggle,
}: TopbarProps) {
  const status = STATUS_MAP[connectionStatus];

  return (
    <header className="topbar">
      <div className="topbar-left">
        <a href="/landing.html" className="topbar-back">
          <i className="fa-solid fa-arrow-left" /> 返回官网
        </a>
        <div className="topbar-logo">LT</div>
        <div className="topbar-title">
          LiveTranslate Console
          <span>Qwen-LiveTranslate</span>
        </div>
      </div>

      <div className="topbar-center">
        <div className="mode-switch">
          <button className={`mode-btn ${mode === 'mic' ? 'active' : ''}`} onClick={() => onModeChange('mic')}>
            <i className="fa-solid fa-microphone" /> 麦克风
          </button>
          <button className={`mode-btn ${mode === 'tab' ? 'active' : ''}`} onClick={() => onModeChange('tab')}>
            <i className="fa-solid fa-desktop" /> 标签页
          </button>
        </div>

        <div className="lang-group">
          <select className="lang-select" value={srcLang} onChange={(e) => onSrcLangChange(e.target.value)}>
            <option value="en-US">English</option>
            <option value="zh-CN">中文</option>
            <option value="ja-JP">日本語</option>
            <option value="ko-KR">한국어</option>
            <option value="fr-FR">Français</option>
            <option value="de-DE">Deutsch</option>
            <option value="es-ES">Español</option>
            <option value="ru-RU">Русский</option>
          </select>
          <span className="lang-arrow"><i className="fa-solid fa-arrow-right" /></span>
          <select className="lang-select" value={tgtLang} onChange={(e) => onTgtLangChange(e.target.value)}>
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

        <div className={`status-dot ${status.class}`}>
          <div className="dot" />
          <span>{status.text}</span>
        </div>
      </div>

      <div className="topbar-right">
        <button className={`btn-main ${isRunning ? 'running' : 'idle'}`} onClick={onToggle}>
          {isRunning ? (
            <><i className="fa-solid fa-stop" /><span>停止翻译</span></>
          ) : (
            <><i className="fa-solid fa-play" /><span>开始翻译</span></>
          )}
        </button>
      </div>
    </header>
  );
}
