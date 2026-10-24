import { InlineKeyboard, InputFile, type Bot, type Context } from "grammy";
import { buildTelegramCopy } from "../content/captions.ts";
import type { PipelineDeps } from "../pipeline/engine.ts";
import { applyEdit, approveAndPublish, cancelSignal, ingestAndProcess, regenerate } from "../pipeline/engine.ts";

const sessions = new Map<string, { signalId?: string; awaitingEdit: boolean }>();

function previewKeyboard() {
  return new InlineKeyboard()
    .text("Confirm & Publish", "confirm")
    .text("Edit", "edit")
    .row()
    .text("Regenerate", "regen")
    .text("Cancel", "cancel");
}

function isAdmin(deps: PipelineDeps, userId: string): boolean {
  const allow = deps.config.telegramAdminIds;
  if (allow.length === 0) return false;
  return allow.includes(userId);
}

export function registerTelegram(bot: Bot, deps: PipelineDeps) {
  bot.on("message", async (ctx) => {
    const userId = String(ctx.from?.id ?? "");
    if (!isAdmin(deps, userId)) {
      await ctx.reply("Unauthorized. This bot is restricted to the administrator allowlist.");
      return;
    }
    const chatKey = String(ctx.chat.id);
    const session = sessions.get(chatKey) ?? { awaitingEdit: false };

    const text = ctx.message.text ?? ctx.message.caption ?? "";
    if (session.awaitingEdit && session.signalId && text) {
      session.awaitingEdit = false;
      sessions.set(chatKey, session);
      const result = await applyEdit(deps, session.signalId, userId, text);
      await replyPipeline(ctx, deps, result);
      return;
    }

    if (!text.trim() && !ctx.message.photo) {
      await ctx.reply("Send signal shorthand, or attach a chart with a caption.");
      return;
    }

    let image: { buffer: Buffer; mimeType: string; filename: string } | undefined;
    if (ctx.message.photo?.length) {
      const photo = ctx.message.photo.at(-1);
      if (photo) {
        const file = await ctx.api.getFile(photo.file_id);
        if (file.file_path && deps.config.telegramBotToken) {
          const url = `https://api.telegram.org/file/bot${deps.config.telegramBotToken}/${file.file_path}`;
          const res = await fetch(url);
          const buf = Buffer.from(await res.arrayBuffer());
          image = { buffer: buf, mimeType: "image/jpeg", filename: "chart.jpg" };
        }
      }
    }

    const result = await ingestAndProcess(deps, {
      text: text || "see attached chart",
      editor: userId,
      source: {
        channel: "telegram",
        chat_id: chatKey,
        message_id: String(ctx.message.message_id),
        raw_prompt: text
      },
      image
    });
    if (result.signal) {
      sessions.set(chatKey, { signalId: result.signal.signal.id, awaitingEdit: false });
    }
    await replyPipeline(ctx, deps, result);
  });

  bot.on("callback_query:data", async (ctx) => {
    const userId = String(ctx.from.id);
    if (!isAdmin(deps, userId)) {
      await ctx.answerCallbackQuery({ text: "Unauthorized" });
      return;
    }
    const chatKey = String(ctx.chat?.id ?? ctx.from.id);
    const session = sessions.get(chatKey);
    const signalId = session?.signalId;
    if (!signalId) {
      await ctx.answerCallbackQuery({ text: "No active signal" });
      return;
    }
    const data = ctx.callbackQuery.data;
    if (data === "edit") {
      sessions.set(chatKey, { signalId, awaitingEdit: true });
      await ctx.answerCallbackQuery();
      await ctx.reply("Send the field change, e.g. Change SL to 4137");
      return;
    }
    if (data === "regen") {
      await ctx.answerCallbackQuery({ text: "Regenerating" });
      await replyPipeline(ctx, deps, await regenerate(deps, signalId));
      return;
    }
    if (data === "cancel") {
      await ctx.answerCallbackQuery({ text: "Cancelled" });
      await replyPipeline(ctx, deps, cancelSignal(deps, signalId));
      return;
    }
    if (data === "confirm") {
      await ctx.answerCallbackQuery({ text: "Publishing" });
      const result = await approveAndPublish(deps, signalId, userId);
      await replyPipeline(ctx, deps, result);
    }
  });
}

async function replyPipeline(
  ctx: Context,
  deps: PipelineDeps,
  result: Awaited<ReturnType<typeof ingestAndProcess>>
) {
  if (!result.ok) {
    await ctx.reply(result.issues ?? result.code ?? "Failed");
    return;
  }
  const id = result.signal?.signal.id;
  const png = id ? `${deps.config.storageDir}/${id}.png` : undefined;
  const summary = result.signal
    ? `${result.signal.signal.direction} ${result.signal.signal.symbol}\nStatus: ${result.signal.workflow.status}\nExtraction: ${result.signal.extraction.method}`
    : "OK";
  if (png && result.signal?.workflow.status === "AWAITING_APPROVAL") {
    const copy = buildTelegramCopy(result.signal);
    await ctx.reply(copy.header ?? summary, { disable_web_page_preview: true });
    await ctx.replyWithPhoto(new InputFile(png), { caption: copy.text, reply_markup: previewKeyboard() });
    return;
  }
  await ctx.reply(summary);
}
