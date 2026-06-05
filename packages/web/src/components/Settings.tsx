import { useState, useEffect } from 'react';

interface SettingsProps {
  onApiKeyChange: (key: string) => void;
}

export function Settings({ onApiKeyChange }: SettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  // 从 localStorage 加载已保存的 key
  useEffect(() => {
    const savedKey = localStorage.getItem('dashscope_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      onApiKeyChange(savedKey);
    }
  }, [onApiKeyChange]);

  const handleSave = () => {
    localStorage.setItem('dashscope_api_key', apiKey);
    onApiKeyChange(apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      {/* 设置按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 right-4 w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all flex items-center justify-center z-50"
        title="设置"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>

      {/* 设置面板 */}
      {isOpen && (
        <div className="fixed top-16 right-4 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-5 z-50">
          <h3 className="text-white text-lg font-bold mb-4">设置</h3>

          <div className="space-y-4">
            {/* API Key 输入 */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                阿里云 DashScope API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <p className="text-gray-500 text-xs mt-1">
                用于千问 TTS 语音合成，获取地址：
                <a
                  href="https://dashscope.console.aliyun.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  DashScope 控制台
                </a>
              </p>
            </div>

            {/* 保存按钮 */}
            <button
              onClick={handleSave}
              className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${
                saved
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {saved ? '已保存' : '保存'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
