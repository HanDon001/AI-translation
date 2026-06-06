/**
 * Mock 翻译器
 * 模拟翻译数据，用于开发和测试
 */
export class MockTranslator {
  private readonly DEMO_SENTENCES = [
    { src: 'Good morning everyone', tgt: '大家早上好' },
    { src: "Thank you for joining today's session", tgt: '感谢参加今天的会议' },
    { src: "I'd like to share some insights", tgt: '我想分享一些见解' },
    { src: 'about the future of AI', tgt: '关于人工智能的未来' },
    { src: 'The rapid development of large language models', tgt: '大语言模型的快速发展' },
    { src: 'has changed everything', tgt: '改变了一切' },
    { src: 'We believe that real-time translation', tgt: '我们相信实时翻译' },
    { src: 'will break down language barriers', tgt: '将打破语言障碍' },
  ];

  getTranslation(index: number): { src: string; tgt: string } {
    return this.DEMO_SENTENCES[index % this.DEMO_SENTENCES.length];
  }

  getPartialTranslation(index: number, progress: number): string {
    const sent = this.getTranslation(index);
    return sent.tgt.substring(0, Math.ceil(sent.tgt.length * progress));
  }
}
