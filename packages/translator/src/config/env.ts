export function loadEnv() {
  return {
    PORT: parseInt(process.env.PORT ?? '3002', 10),
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
    MOCK_MODE: process.env.MOCK_MODE !== 'false',
    MOCK_LATENCY_MS: parseInt(process.env.MOCK_LATENCY_MS ?? '50', 10),
    MAX_CONTEXT_CHARS: parseInt(process.env.MAX_CONTEXT_CHARS ?? '500', 10),
  };
}

export type EnvConfig = ReturnType<typeof loadEnv>;
