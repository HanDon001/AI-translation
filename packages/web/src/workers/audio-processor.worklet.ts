/**
 * AudioWorklet 处理器 — 严格每 400ms 输出一个 PCM 切片
 *
 * 运行在独立线程，无法访问 DOM，只能通过 postMessage 通信
 */
const SAMPLE_RATE = 16_000;
const WINDOW_MS = 400;
const TARGET_SAMPLES = SAMPLE_RATE * (WINDOW_MS / 1000); // 6400

class AudioProcessor extends AudioWorkletProcessor {
  private buffer: Float32Array = new Float32Array(0);

  process(inputs: Float32Array[][], _outputs: Float32Array[][], _parameters: Record<string, Float32Array>): boolean {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0];
    if (!channelData) return true;

    // 累积样本
    const combined = new Float32Array(this.buffer.length + channelData.length);
    combined.set(this.buffer);
    combined.set(channelData, this.buffer.length);
    this.buffer = combined;

    // 当累积样本 >= 目标数时，切片发送
    while (this.buffer.length >= TARGET_SAMPLES) {
      const slice = this.buffer.slice(0, TARGET_SAMPLES);
      this.buffer = this.buffer.slice(TARGET_SAMPLES);

      this.port.postMessage({
        type: 'audio_chunk',
        data: slice,
      });
    }

    return true; // 保持处理器存活
  }
}

registerProcessor('audio-processor', AudioProcessor);
