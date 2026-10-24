import OpenAI from "openai";
import {
  GUIDELINE_VERSION,
  PROMPT_VERSION,
  type Extractor,
  type ExtractionInput,
  type ExtractionOutcome
} from "../../domain/types.ts";
import { aiExtractedCoreSchema } from "../../schemas/trading-signal.ts";

export const SYSTEM_INSTRUCTION = `You are a trading signal data extraction engine.

Convert administrator instructions into the TradingSignal schema.

The administrator's explicit numeric values are authoritative.
The source chart is contextual evidence only.

Never invent missing trading levels.
Never modify administrator-provided levels.

If required information is missing or ambiguous, return status NEEDS_CLARIFICATION with a missing list.

Return only the defined structured output.`;

export const BUSINESS_GUIDELINE = `Required fields: symbol, direction, timeframe, entry zone, stop loss, at least one take-profit zone.
SHORT: SL normally above entry; TP normally below entry.
LONG: SL normally below entry; TP normally above entry.
These are structural notes, not permission to modify administrator values.
Normalize GOLD/XAU to XAUUSD when the admin clearly means gold.
Timeframe units must be MINUTES, HOURS, or DAYS.`;

export class AIExtractor implements Extractor {
  constructor(
    private readonly client: OpenAI | null,
    private readonly model: string
  ) {}

  async extract(input: ExtractionInput): Promise<ExtractionOutcome> {
    if (!this.client) {
      return {
        ok: false,
        code: "EXTRACTOR_UNAVAILABLE",
        method: "ai",
        message: "OPENAI_API_KEY is not configured. Deterministic shorthand still works without AI."
      };
    }

    const userText = `${BUSINESS_GUIDELINE}\n\nAdministrator prompt:\n${input.text}`;
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: "text", text: userText }];
    if (input.imageBase64 && input.imageMimeType) {
      content.push({
        type: "image_url",
        image_url: {
          url: `data:${input.imageMimeType};base64,${input.imageBase64}`,
          detail: "high"
        }
      });
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "trading_signal_extraction",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                status: { type: "string", enum: ["ok", "NEEDS_CLARIFICATION"] },
                missing: { type: ["array", "null"], items: { type: "string" } },
                message: { type: ["string", "null"] },
                symbol: { type: ["string", "null"] },
                direction: { anyOf: [{ type: "string", enum: ["LONG", "SHORT"] }, { type: "null" }] },
                timeframe: {
                  anyOf: [
                    {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        value: { type: "integer" },
                        unit: { type: "string", enum: ["MINUTES", "HOURS", "DAYS"] }
                      },
                      required: ["value", "unit"]
                    },
                    { type: "null" }
                  ]
                },
                entry_zone: {
                  anyOf: [
                    {
                      type: "object",
                      additionalProperties: false,
                      properties: { low: { type: "number" }, high: { type: "number" } },
                      required: ["low", "high"]
                    },
                    { type: "null" }
                  ]
                },
                stop_loss: {
                  anyOf: [
                    {
                      type: "object",
                      additionalProperties: false,
                      properties: { price: { type: "number" } },
                      required: ["price"]
                    },
                    { type: "null" }
                  ]
                },
                take_profit_zones: {
                  anyOf: [
                    {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          id: { type: "string" },
                          low: { type: "number" },
                          high: { type: "number" }
                        },
                        required: ["id", "low", "high"]
                      }
                    },
                    { type: "null" }
                  ]
                }
              },
              required: [
                "status",
                "missing",
                "message",
                "symbol",
                "direction",
                "timeframe",
                "entry_zone",
                "stop_loss",
                "take_profit_zones"
              ]
            }
          }
        },
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content }
        ]
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) {
        return { ok: false, code: "NEEDS_CLARIFICATION", method: "ai", message: "Empty model response", missing: ["output"] };
      }
      const parsedJson = JSON.parse(raw);
      const parsed = aiExtractedCoreSchema.safeParse(parsedJson);
      if (!parsed.success) {
        return {
          ok: false,
          code: "NEEDS_CLARIFICATION",
          method: "ai",
          message: "Model output failed schema validation",
          missing: parsed.error.issues.map((i) => i.path.join("."))
        };
      }
      const data = parsed.data;
      if (data.status !== "ok") {
        return {
          ok: false,
          code: "NEEDS_CLARIFICATION",
          method: "ai",
          message: data.message ?? "Model requested clarification",
          missing: data.missing ?? []
        };
      }
      if (!data.symbol || !data.direction || !data.timeframe || !data.entry_zone || !data.stop_loss || !data.take_profit_zones?.length) {
        return {
          ok: false,
          code: "NEEDS_CLARIFICATION",
          method: "ai",
          message: "Required trading fields missing after AI extraction",
          missing: ["core"]
        };
      }
      return {
        ok: true,
        method: "ai",
        ai: {
          provider: "openai",
          model: this.model,
          prompt_version: PROMPT_VERSION,
          guideline_version: GUIDELINE_VERSION
        },
        core: {
          symbol: data.symbol.toUpperCase(),
          direction: data.direction,
          timeframe: data.timeframe,
          entry_zone: data.entry_zone,
          stop_loss: data.stop_loss,
          take_profit_zones: data.take_profit_zones
        }
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        code: "EXTRACTOR_UNAVAILABLE",
        method: "ai",
        message: `AI extractor failed: ${message}`
      };
    }
  }
}
