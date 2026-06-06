/**
 * 音频块 DTO
 */
export interface AudioChunkDTO {
  windowId: number;
  startMs: number;
  duration: number;
  pcmData: string;
}
