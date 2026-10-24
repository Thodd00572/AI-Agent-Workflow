import { resolve } from "node:path";

export interface AppConfig {
  nodeEnv: string;
  port: number;
  baseUrl: string;
  databaseUrl: string;
  openaiApiKey?: string;
  openaiModel: string;
  telegramBotToken?: string;
  telegramWebhookSecret: string;
  telegramAdminIds: string[];
  telegramPublishChatId?: string;
  storageDir: string;
  cardWidth: number;
  cardHeight: number;
  adminToken?: string;
  twelveDataApiKey?: string;
  marketDataProvider: "auto" | "yahoo" | "twelvedata";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const adminIds = (env.TELEGRAM_ADMIN_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    nodeEnv: env.NODE_ENV ?? "development",
    port: Number(env.PORT ?? 3000),
    baseUrl: env.BASE_URL ?? "http://localhost:3000",
    databaseUrl: env.DATABASE_URL ?? "file:./data/signal-platform.sqlite",
    openaiApiKey: env.OPENAI_API_KEY || undefined,
    openaiModel: env.OPENAI_MODEL ?? "gpt-5.6",
    telegramBotToken: env.TELEGRAM_BOT_TOKEN || undefined,
    telegramWebhookSecret: env.TELEGRAM_WEBHOOK_SECRET ?? "change-me",
    telegramAdminIds: adminIds,
    telegramPublishChatId: env.TELEGRAM_PUBLISH_CHAT_ID || undefined,
    storageDir: resolve(env.STORAGE_DIR ?? "./data/storage"),
    cardWidth: Number(env.CARD_WIDTH ?? 1920),
    cardHeight: Number(env.CARD_HEIGHT ?? 1080),
    adminToken: env.ADMIN_TOKEN || undefined,
    twelveDataApiKey: env.TWELVEDATA_API_KEY || undefined,
    marketDataProvider: env.MARKET_DATA_PROVIDER === "yahoo" || env.MARKET_DATA_PROVIDER === "twelvedata" ? env.MARKET_DATA_PROVIDER : "auto"
  };
}
