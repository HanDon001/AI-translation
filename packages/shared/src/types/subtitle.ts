/** 字幕段落 */
export interface SubtitleSegment {
  id: string;
  text: string;
  start_ms: number;
  end_ms: number;
  style: SubtitleStyle;
}

/** 字幕样式 */
export type SubtitleStyle = 'temp' | 'final';

/** 字幕修正动作 */
export type PatchAction = 'ADD_TEMP' | 'MARK_FINAL' | 'INVALIDATE';

/** 后端 -> 前端字幕校正指令 */
export interface SubtitlePatchPayload {
  action: PatchAction;
  /** 受影响的时间轴区间 [start_ms, end_ms] */
  target_range?: [number, number];
  /** 替换的新文本 */
  new_text?: string;
  /** 字幕样式 */
  style?: SubtitleStyle;
}
