/**
 * AudioWorklet 全局类型声明
 * 这些类型在 AudioWorklet 线程中可用，但 TypeScript 标准 DOM 类型中不包含
 */

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

declare function registerProcessor(name: string, processorCtor: typeof AudioWorkletProcessor): void;
