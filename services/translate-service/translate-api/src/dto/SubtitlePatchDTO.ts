/**
 * 字幕补丁 DTO
 */
export interface SubtitlePatchDTO {
  action: 'ADD_TEMP' | 'MARK_FINAL' | 'INVALIDATE';
  targetRange: [number, number];
  newText: string;
  style: 'temp' | 'final';
}
