import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Bot, InputFile } from "grammy";
import type { PublishRequest, PublishResult, Publisher } from "../domain/types.ts";

export class TelegramPublisher implements Publisher {
  platform = "telegram";

  constructor(
    private readonly token: string | undefined,
    private readonly defaultChatId: string | undefined,
    private readonly bot?: Bot
  ) {}

  async validateConfiguration() {
    if (!this.token) {
      return { ok: true, message: "No bot token: publications will be stored locally (operator inbox)." };
    }
    return { ok: true, message: "Telegram bot token present" };
  }

  async publish(input: PublishRequest): Promise<PublishResult> {
    const chatId = this.defaultChatId || input.targetId;
    if (!this.token || !this.bot) {
      return {
        status: "succeeded",
        externalPostId: `local-telegram:${input.signalId}:${input.revision}`
      };
    }
    try {
      if (input.headerText) {
        await this.bot.api.sendMessage(chatId, input.headerText, { disable_web_page_preview: true });
      }
      const msg = await this.bot.api.sendPhoto(chatId, new InputFile(input.assetPath), {
        caption: input.caption
      });
      return { status: "succeeded", externalPostId: String(msg.message_id) };
    } catch (err) {
      return {
        status: "failed",
        errorCode: "TELEGRAM_SEND_FAILED",
        errorMessage: err instanceof Error ? err.message : String(err)
      };
    }
  }

  async getStatus() {
    return { status: "unknown" as const };
  }
}

export class LocalInboxPublisher implements Publisher {
  platform: string;
  constructor(
    platform: string,
    private readonly inboxDir: string
  ) {
    this.platform = platform;
  }

  async validateConfiguration() {
    return { ok: false, message: `${this.platform} adapter is stubbed until Phase 2 OAuth is configured.` };
  }

  async publish(input: PublishRequest): Promise<PublishResult> {
    mkdirSync(this.inboxDir, { recursive: true });
    writeFileSync(
      join(this.inboxDir, `${input.idempotencyKey}.json`),
      JSON.stringify({ ...input, storedAt: new Date().toISOString() }, null, 2)
    );
    return {
      status: "skipped",
      errorCode: "PLATFORM_NOT_ENABLED",
      errorMessage: `${this.platform} is not enabled in Phase 1`
    };
  }

  async getStatus() {
    return { status: "not_enabled" as const };
  }
}

export function createPublishers(opts: {
  telegramToken?: string;
  telegramChatId?: string;
  bot?: Bot;
  inboxDir: string;
}): Record<string, Publisher> {
  return {
    telegram: new TelegramPublisher(opts.telegramToken, opts.telegramChatId, opts.bot),
    x: new LocalInboxPublisher("x", opts.inboxDir),
    facebook: new LocalInboxPublisher("facebook", opts.inboxDir),
    instagram: new LocalInboxPublisher("instagram", opts.inboxDir),
    tiktok: new LocalInboxPublisher("tiktok", opts.inboxDir)
  };
}

export function idempotencyKey(signalId: string, platform: string, targetId: string, revision: number): string {
  return `${signalId}:${platform}:${targetId}:${revision}`;
}

export type { Publisher, PublishRequest, PublishResult };
