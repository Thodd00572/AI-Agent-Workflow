import pino from "pino";

export function createLogger() {
  return pino({
    level: process.env.LOG_LEVEL ?? "info",
    formatters: {
      level(label) {
        return { level: label };
      }
    }
  });
}

export type Logger = ReturnType<typeof createLogger>;
