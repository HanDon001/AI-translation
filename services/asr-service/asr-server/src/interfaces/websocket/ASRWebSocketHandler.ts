import type { WebSocket } from 'ws';
import { DashScopeWSClient } from '../../infrastructure/external/DashScopeWSClient.js';

const DEFAULT_MODEL = 'qwen3-asr-flash-realtime';
const DEFAULT_SOURCE_LANG = 'en';
const DEFAULT_TARGET_LANG = 'zh';

/**
 * 增量翻译防抖间隔（ms）
 */
const DEBOUNCE_MS = 2500;

/**
 * MARK_FINAL 后的冷却期（ms）
 * 冷却期内忽略所有增量 ASR 结果，防止残留碎片
 */
const COOLDOWN_MS = 800;

/**
 * 最小有效文本长度
 */
const MIN_TEXT_LENGTH = 4;

/**
 * 分块策略：满 N 个单词即切
 */
const MAX_WORDS = 20;

function hasContent(text: string): boolean {
  return text.replace(/[\s\p{P}]/gu, '').length >= MIN_TEXT_LENGTH;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * ASR WebSocket 处理器
 *
 * 冷却期机制:
 *   1. MARK_FINAL 后进入 800ms 冷却期
 *   2. 冷却期内忽略所有增量 stash（防止残留碎片）
 *   3. 新的 speech_started 信号提前结束冷却期
 *   4. 版本号机制：MARK_FINAL 递增版本号，旧的增量翻译自动失效
 */
export class ASRWebSocketHandler {
  private translateVersion = 0;

  handleConnection(duplexStream: { socket: WebSocket; on: Function }): void {
    const rawWs: WebSocket = duplexStream.socket;
    let dashScopeClient: DashScopeWSClient | null = null;
    let apiKey = '';
    let sourceLang = DEFAULT_SOURCE_LANG;
    let targetLang = DEFAULT_TARGET_LANG;
    let glossary: Record<string, string> = {};

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let cooldownTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingText = '';
    let isCoolingDown = false;

    // 上下文翻译：保留最近 2 句原文+译文（保证指代准确，首包快）
    const contextHistory: Array<{ src: string; tgt: string }> = [];
    const CONTEXT_MAX = 2;

    console.log('[ASR] Client connected');

    const enterCooldown = () => {
      isCoolingDown = true;
      if (cooldownTimer) clearTimeout(cooldownTimer);
      cooldownTimer = setTimeout(() => {
        isCoolingDown = false;
        cooldownTimer = null;
        console.log('[ASR] Cooldown ended, ready for new segment');
      }, COOLDOWN_MS);
    };

    const exitCooldown = () => {
      if (isCoolingDown) {
        isCoolingDown = false;
        if (cooldownTimer) {
          clearTimeout(cooldownTimer);
          cooldownTimer = null;
        }
        console.log('[ASR] Cooldown exited by speech_started');
      }
    };

    duplexStream.on('data', async (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        await this.handleMessage(rawWs, msg, {
          getClient: () => dashScopeClient,
          setClient: (c) => { dashScopeClient = c; },
          getApiKey: () => apiKey,
          setApiKey: (k) => { apiKey = k; },
          getSourceLang: () => sourceLang,
          setSourceLang: (l) => { sourceLang = l; },
          getTargetLang: () => targetLang,
          setTargetLang: (l) => { targetLang = l; },
          getDebounceTimer: () => debounceTimer,
          setDebounceTimer: (t) => { debounceTimer = t; },
          getPendingText: () => pendingText,
          setPendingText: (t) => { pendingText = t; },
          getIsCoolingDown: () => isCoolingDown,
          enterCooldown,
          exitCooldown,
          getContext: () => contextHistory,
          addContext: (src: string, tgt: string) => {
            contextHistory.push({ src, tgt });
            if (contextHistory.length > CONTEXT_MAX) contextHistory.shift();
          },
          getGlossary: () => glossary,
          setGlossary: (g: Record<string, string>) => { glossary = g; },
        });
      } catch (err) {
        console.error('[ASR] Error:', err);
        this.sendError(rawWs, '消息处理失败');
      }
    });

    rawWs.on('close', () => {
      console.log('[ASR] Client disconnected');
      if (debounceTimer) clearTimeout(debounceTimer);
      if (cooldownTimer) clearTimeout(cooldownTimer);
      dashScopeClient?.close();
      dashScopeClient = null;
    });
  }

  private async handleMessage(
    ws: WebSocket,
    msg: { type: string; payload: Record<string, unknown> },
    state: {
      getClient: () => DashScopeWSClient | null;
      setClient: (c: DashScopeWSClient | null) => void;
      getApiKey: () => string;
      setApiKey: (k: string) => void;
      getSourceLang: () => string;
      setSourceLang: (l: string) => void;
      getTargetLang: () => string;
      setTargetLang: (l: string) => void;
      getDebounceTimer: () => ReturnType<typeof setTimeout> | null;
      setDebounceTimer: (t: ReturnType<typeof setTimeout> | null) => void;
      getPendingText: () => string;
      setPendingText: (t: string) => void;
      getIsCoolingDown: () => boolean;
      enterCooldown: () => void;
      exitCooldown: () => void;
      getContext: () => Array<{ src: string; tgt: string }>;
      addContext: (src: string, tgt: string) => void;
      getGlossary: () => Record<string, string>;
      setGlossary: (g: Record<string, string>) => void;
    }
  ): Promise<void> {
    const { type, payload } = msg;

    // ---- flush 增量（带版本号检查）----
    const flushPartial = async () => {
      const timer = state.getDebounceTimer();
      if (timer) { clearTimeout(timer); state.setDebounceTimer(null); }

      const text = state.getPendingText();
      state.setPendingText('');
      if (!text) return;

      const version = this.translateVersion;
      const translated = await this.translateText(text, state.getSourceLang(), state.getTargetLang(), state.getApiKey(), state.getContext(), state.getGlossary());

      if (version !== this.translateVersion) {
        console.log(`[ASR] Discard stale partial (v${version})`);
        return;
      }

      ws.send(JSON.stringify({
        type: 'subtitle_patch',
        payload: {
          action: 'ADD_TEMP',
          new_text: translated,
          source_text: text,
          target_range: [Date.now(), Date.now() + 1000],
          style: 'temp',
        },
      }));
    };

    // ---- 设置 API Key ----
    if (type === 'set_api_key') {
      const key = (payload?.apiKey as string) || '';
      if (!key) { this.sendError(ws, 'API Key 不能为空'); return; }

      state.setApiKey(key);
      console.log('[ASR] Connecting to DashScope...');

      try {
        const client = new DashScopeWSClient();

        // 语音开始 → 提前结束冷却期
        client.onSpeechStarted(() => {
          state.exitCooldown();
        });

        client.onTranscript(async (text: string, isFinal: boolean) => {
          // ===== 最终结果 =====
          if (isFinal) {
            const timer = state.getDebounceTimer();
            if (timer) { clearTimeout(timer); state.setDebounceTimer(null); }
            state.setPendingText('');

            // 递增版本号，使旧的增量翻译失效
            this.translateVersion++;

            if (!text) {
              // 空的最终结果，进入冷却期
              state.enterCooldown();
              return;
            }

            const translated = await this.translateText(text, state.getSourceLang(), state.getTargetLang(), state.getApiKey(), state.getContext(), state.getGlossary());
            state.addContext(text, translated);
            ws.send(JSON.stringify({
              type: 'subtitle_patch',
              payload: {
                action: 'MARK_FINAL',
                new_text: translated,
                source_text: text,
                target_range: [Date.now(), Date.now() + 2000],
                style: 'final',
              },
            }));
            console.log(`[ASR] FINAL: "${text.substring(0, 60)}" → "${translated.substring(0, 60)}"`);

            // 进入冷却期，防止残留碎片
            state.enterCooldown();
            return;
          }

          // ===== 增量结果 =====

          // 冷却期内忽略所有增量
          if (state.getIsCoolingDown()) {
            return;
          }

          if (!text || !hasContent(text)) return;

          state.setPendingText(text);

          // 分块策略：遇标点即切（≥10字） 或 满20字即切 或 VAD停顿即切
          const wordCount = countWords(text);
          const charCount = text.replace(/[\s\p{P}]/gu, '').length;
          if ((/[.!?。！？]\s*$/.test(text.trim()) && charCount >= 10) || wordCount >= MAX_WORDS) {
            await flushPartial();
            return;
          }

          // 长防抖
          const oldTimer = state.getDebounceTimer();
          if (oldTimer) clearTimeout(oldTimer);

          const timer = setTimeout(() => { flushPartial(); }, DEBOUNCE_MS);
          state.setDebounceTimer(timer);
        });

        client.onError((err) => {
          console.error('[ASR] DashScope error:', err.message);
          this.sendError(ws, `ASR 服务错误: ${err.message}`);
        });

        await client.connect(key, DEFAULT_MODEL);
        state.setClient(client);

        ws.send(JSON.stringify({ type: 'auth_success' }));
        console.log('[ASR] DashScope connected, ready for audio');
      } catch (err) {
        console.error('[ASR] DashScope connection failed:', err);
        this.sendError(ws, `ASR 连接失败: ${err instanceof Error ? err.message : '未知错误'}`);
      }
      return;
    }

    // ---- 音频数据转发 ----
    if (type === 'audio_chunk') {
      const client = state.getClient();
      if (!client) return;
      const pcmData = payload?.pcm_data as string;
      if (pcmData) client.sendAudio(pcmData);
      return;
    }

    // ---- 术语表 ----
    if (type === 'set_glossary') {
      const gl = (payload?.glossary as Record<string, string>) || {};
      state.setGlossary(gl);
      console.log(`[ASR] Glossary updated: ${Object.keys(gl).length} entries`);
      return;
    }

    // ---- 配置参数 ----
    if (type === 'config') {
      if (payload?.sourceLang) state.setSourceLang(payload.sourceLang as string);
      if (payload?.targetLang) state.setTargetLang(payload.targetLang as string);
      console.log(`[ASR] Config: ${state.getSourceLang()} → ${state.getTargetLang()}`);
      return;
    }
  }

  private async translateText(text: string, sourceLang: string, targetLang: string, apiKey: string, context?: Array<{ src: string; tgt: string }>, glossary?: Record<string, string>): Promise<string> {
    if (sourceLang === targetLang) return text;
    if (!text.trim()) return text;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch('http://localhost:3002/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, sourceLang, targetLang, context, apiKey, glossary }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        const data = (await resp.json()) as { code: number; data?: string; message?: string };
        if (data.code === 0 && data.data) return data.data;

        console.error(`[ASR] Translation attempt ${attempt} failed: code=${data.code} msg=${data.message}`);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[ASR] Translation attempt ${attempt} error: ${errMsg}`);
      }

      if (attempt === 1) await new Promise(r => setTimeout(r, 500));
    }

    console.error(`[ASR] Translation exhausted for: "${text.substring(0, 50)}"`);
    return text;
  }

  private sendError(ws: WebSocket, message: string): void {
    try {
      ws.send(JSON.stringify({ type: 'error', payload: { message } }));
    } catch { /* connection may be closed */ }
  }
}
