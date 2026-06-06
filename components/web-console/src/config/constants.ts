/**
 * 语言映射、演示数据、魔法数字
 */

/** BCP-47 → 短代码 */
export const LANG_MAP: Record<string, string> = {
  'en-US': 'en', 'zh-CN': 'zh', 'ja-JP': 'ja', 'ko-KR': 'ko',
  'fr-FR': 'fr', 'de-DE': 'de', 'es-ES': 'es', 'ru-RU': 'ru',
};

/** 演示模式句子 */
export const DEMO_SENTENCES = [
  { src: "Good morning everyone, thank you for joining today's session.", tgt: "大家早上好，感谢参加今天的会议。" },
  { src: "I'd like to share some insights about the future of AI.", tgt: "我想分享一些关于人工智能未来的见解。" },
  { src: "The rapid development of large language models has changed everything.", tgt: "大语言模型的快速发展改变了一切。" },
  { src: "We believe that real-time translation will break down language barriers.", tgt: "我们相信实时翻译将打破语言障碍。" },
  { src: "Let me show you a demo of our latest capabilities.", tgt: "让我展示一下我们最新能力的演示。" },
  { src: "The accuracy has improved significantly compared to last year.", tgt: "与去年相比，准确率有了显著提升。" },
  { src: "We are now supporting over fifty languages in real time.", tgt: "我们现在实时支持超过五十种语言。" },
  { src: "The system can handle both formal speeches and casual conversations.", tgt: "系统可以处理正式演讲和日常对话。" },
  { src: "Latency has been reduced to under five hundred milliseconds.", tgt: "延迟已降低到五百毫秒以内。" },
  { src: "Thank you for your attention. I'm happy to take questions now.", tgt: "感谢大家的关注。我现在很乐意回答问题。" },
];

/** 源语言选项 */
export const SRC_LANGS = [
  { value: 'en-US', label: 'English' },
  { value: 'zh-CN', label: '中文' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'es-ES', label: 'Español' },
  { value: 'ru-RU', label: 'Русский' },
] as const;

/** 目标语言选项 */
export const TGT_LANGS = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'ru', label: 'Русский' },
] as const;
