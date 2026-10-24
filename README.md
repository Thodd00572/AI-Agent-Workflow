# Signal Platform

Phase 1 vertical slice of the AI Trading Signal Content Automation Platform:

**Telegram / Operator web → Extraction router (deterministic parser | OpenAI) → validated `TradingSignal` JSON → HTML template → PNG → approval → Telegram publication**

Administrator values are authoritative. The parser never invents levels. HTML is a renderer, not a store. PNG is an asset, not the canonical object. Nothing publishes without validation and explicit approval.

## Run locally

```bash
cp .env.example .env
npm install
npx playwright install chromium
npm test
npm run dev
```

- API: http://localhost:3000
- Operator desk: http://localhost:5173

Paste shorthand such as:

```text
SHORT XAUUSD 30m
Entry: 4116-4129
SL: 4135
TP1: 4092-4104
TP2: 4016-4020
```

Then confirm & publish. Without a Telegram bot token, publication is recorded locally as a successful Telegram adapter result so the quality gateway can be exercised.

## Telegram

Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ADMIN_IDS`, and `TELEGRAM_PUBLISH_CHAT_ID`. Webhook path:

`POST /webhooks/telegram/<TELEGRAM_WEBHOOK_SECRET>`

## Architecture rules encoded in code

1. `TradingSignal` JSON is the source of truth (`canonical_json` + revisions).
2. Extraction is deterministic-first; AI runs for freeform text, images, or parser `NEEDS_CLARIFICATION`.
3. Directional validation never auto-corrects invalid numbers.
4. Publishers are adapters. X/Meta/TikTok are stubbed until Phase 2.
5. Publication idempotency key: `signal_id + platform + target_id + revision`.

See `docs/spec.md` for the full specification.
