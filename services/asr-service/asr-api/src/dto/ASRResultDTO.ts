/**
 * ASR 结果 DTO
 */
export interface ASRResultDTO {
  text: string;
  isFinal: boolean;
  confidence: number;
  startMs: number;
  endMs: number;
}
