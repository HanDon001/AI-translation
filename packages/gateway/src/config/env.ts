/** 类型化环境变量加载 */
export function loadEnv() {
  return {
    PORT: parseInt(process.env.PORT ?? '3000', 10),
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
    ASR_WS_URL: process.env.ASR_WS_URL ?? 'ws://localhost:3001/ws',
    TRANSLATOR_WS_URL: process.env.TRANSLATOR_WS_URL ?? 'ws://localhost:3002/ws',
  };
}

export type EnvConfig = ReturnType<typeof loadEnv>;
