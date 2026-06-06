# LiveTranslate — 实时同声传译助手

一边说英文，一边出中文翻译字幕。支持浏览器和桌面悬浮字幕两种显示方式。

## 它能做什么

1. **实时语音识别**：麦克风或浏览器标签页音频 → 实时转英文文字（阿里 DashScope Qwen ASR）
2. **智能翻译**：英文识别结果 → 中文翻译（DashScope LLM，自带语法纠错）
3. **上下文翻译**：记住前 2 句翻译内容，代词 "it"/"they" 不会翻错
4. **双端显示**：
   - **Web 控制台**：浏览器里看翻译结果、日志、波形
   - **桌面字幕**：悬浮在屏幕最上层，任何软件上方都能看到

## 效果演示

```
[上方] he heard other students using...     ← 实时识别（快速滚动）
[下方] 他听到其他同学自信地使用一些他从未    ← LLM 纠错后的精确翻译
       听过的词汇，大家纷纷谈论自己的旅行
```

## 快速开始

### 环境要求

- **Node.js** >= 20
- **pnpm** >= 9（`npm install -g pnpm`）
- **Python** >= 3.10（桌面字幕需要）
- **阿里云 DashScope API Key**（[申请地址](https://dashscope.console.aliyun.com/)）

### 一键启动（Windows）

```bash
# 1. 安装 pnpm（如果没有）
npm install -g pnpm

# 2. 一键启动
start.bat
```

`start.bat` 会自动：
- 杀掉占用端口的旧进程
- 安装依赖
- 依次启动 5 个服务
- 隐藏启动桌面字幕

### 手动启动

```bash
# 安装依赖
pnpm install

# 启动后端服务（各自独立终端）
pnpm --filter @livetranslate/gateway-service dev      # 网关 → localhost:3000
pnpm --filter @livetranslate/asr-server dev            # 语音识别 → localhost:3001
pnpm --filter @livetranslate/translate-server dev      # 翻译服务 → localhost:3002

# 启动前端
pnpm --filter livetranslate-web-console dev            # 控制台 → localhost:5173

# 启动桌面字幕（可选）
pip install PyQt5 websocket-client
python components/desktop-lyrics/lyrics_win32.py       # 桌面字幕 → localhost:8765
```

### 停止

- Windows：在 `start.bat` 窗口按任意键，会自动杀掉所有服务
- 手动：关掉各终端窗口，或 `taskkill /F /PID <pid>`

## 使用方法

### Web 控制台

1. 打开 http://localhost:5173
2. 点击右上角设置，填入 DashScope API Key
3. 选择模式：
   - **麦克风模式**：翻译自己说的话
   - **标签页模式**：翻译浏览器播放的英文视频/会议
4. 点击「开始翻译」
5. 实时看到英文识别 + 中文翻译

### 桌面字幕

桌面字幕启动后自动连接网关，翻译结果会以悬浮字幕形式显示在屏幕底部。

**操作：**
- **拖动**：左键按住字幕拖动位置
- **缩放**：右下角拖拽调整大小
- **换色**：双击字幕切换 6 种颜色（白/绿/蓝/紫/橙/黄）
- **显示/隐藏**：浏览器控制台的「桌面字幕」按钮，或访问：
  - `http://localhost:8765/show` — 显示
  - `http://localhost:8765/hide` — 隐藏
  - `http://localhost:8765/toggle` — 切换

## 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 3000 | Gateway | 网关，所有服务的统一入口 |
| 3001 | ASR Service | 语音识别 |
| 3002 | Translate Service | 翻译+纠错 |
| 5173 | Frontend | Web 控制台 |
| 8765 | Desktop Lyrics | 桌面字幕控制接口 |

## 常见问题

**Q: 翻译没有反应？**
A: 检查 DashScope API Key 是否正确填写，确认 3000/3001/3002 端口服务都在运行。

**Q: 桌面字幕不显示？**
A: 确认 Python 已安装 PyQt5（`pip install PyQt5`），且 Gateway（端口 3000）正在运行。

**Q: 翻译延迟太高？**
A: 正常延迟约 2-3 秒（含 ASR 识别 + LLM 翻译纠错）。如果超过 5 秒，检查网络连接。

**Q: 支持哪些语言？**
A: 当前默认英文→中文。修改 ASR 服务的 `sourceLang`/`targetLang` 配置可切换其他语言。

## 技术栈

| 用途 | 技术 |
|------|------|
| 后端服务 | Node.js + TypeScript + Fastify |
| 前端 | React 18 + Vite + Tailwind CSS |
| 语音识别 | 阿里 DashScope Qwen ASR（实时流式） |
| 翻译 | 阿里 DashScope Qwen LLM（翻译+纠错一步到位） |
| 桌面字幕 | Python + PyQt5 |
| 包管理 | pnpm monorepo |

## 项目结构

```
同声传译助手/
├── start.bat                    # Windows 一键启动
├── start-lyrics.vbs             # 桌面字幕隐藏启动
│
├── services/
│   ├── asr-service/             # 语音识别服务
│   └── translate-service/       # 翻译服务
│
├── gateway/
│   └── gateway-service/         # API 网关
│
├── components/
│   ├── web-console/             # Web 控制台（React）
│   └── desktop-lyrics/          # 桌面字幕（PyQt5）
│
├── common/                      # 公共模块
├── config/                      # 配置文件
└── docs/                        # 文档
```

## License

MIT
