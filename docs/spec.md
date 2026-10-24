# AI Trading Signal Content Automation Platform

## Core Concept

The system takes a trading-analysis chart image plus an administrator's trading instructions, extracts and structures the signal data, rebuilds a standardized trading signal card using a prebuilt HTML renderer, exports the HTML as PNG, and distributes the PNG to social platforms.

> **Administrator-provided values are authoritative. AI structures and validates them; it must not invent or silently override trading parameters.**

The source chart is contextual evidence, not necessarily the source of truth. The HTML website is internal/hidden and exists only for deterministic rendering.

### Extraction Is Hybrid, Not AI-First

Admin text is usually already near machine-readable (`SHORT XAUUSD 30m`, `SL: 4135`, ...). Routing every signal through an LLM to re-derive numbers the admin already typed explicitly introduces unnecessary probabilistic risk into values that should be deterministic, which conflicts with the authoritative-values rule above.

The system therefore uses two extractors behind one interface, selected by a router, not an AI-only pipeline:

- **`DeterministicParser`** — grammar/regex-based, used when the admin's text matches the known shorthand format and no chart image is attached. Zero cost, zero latency, zero hallucination risk, fully reproducible.
- **`AIExtractor`** — vision/reasoning model, used only when the text doesn't match the known grammar, a chart image needs interpretation, or the deterministic parser flags ambiguity.

Both extractors emit the same canonical `TradingSignal` shape and both still pass through the same deterministic validation stage afterward. See "Extraction Architecture" below.

## Target Trading Signal

Example:

- Direction: SHORT
- Ticker: XAUUSD
- Timeframe: 30 MINUTES
- Entry Zone: 4,116 – 4,129
- Stop Loss: 4,135.00
- Take Profit Zone 1: 4,092 – 4,104
- Take Profit Zone 2: 4,016 – 4,020

These parameters should come from the admin's Telegram prompt/guideline.

## Recommended Architecture

```text
Telegram Bot
    │
    ▼
Extraction Router
    ├── known grammar + no image  → Deterministic Parser
    └── freeform / has image /
        flagged ambiguous         → AI Extractor
    │
    ▼  (both paths converge here)
Canonical TradingSignal JSON
    │
    ▼
Deterministic Validation
    │
    ▼
HTML Chart Renderer
    │
    ▼
Playwright / Chromium
    │
    ▼
PNG Asset
    │
    ▼
Telegram Preview
    │
    ├── Edit
    ├── Regenerate
    ├── Cancel
    └── Confirm
          │
          ▼
    Distribution Adapters
          ├── Telegram
          ├── X
          ├── Facebook
          ├── Instagram
          └── TikTok
```

### Architectural Rules

1. `TradingSignal` JSON is the single source of truth.
2. Explicit admin values override chart interpretation.
3. AI extracts/structures; it does not silently invent or change trading parameters.
4. HTML is a renderer, not a data store.
5. PNG is an asset, not the canonical object.
6. No publication without deterministic validation and explicit human approval.
7. Every social platform is an adapter.
8. Every publication is idempotent and auditable.
9. Every prompt/model/template/schema is versioned.
10. Start as a modular monolith, not microservices.
11. Extraction is deterministic-first: use a grammar-based parser whenever admin text is unambiguous, and reserve AI for freeform text, chart interpretation, and flagged ambiguity — never re-derive explicit admin values through a probabilistic path when a deterministic one is available.

## Canonical Trading Signal Schema

```json
{
  "schema_version": "1.0",
  "signal": {
    "id": "SIG-20260902-0001",
    "symbol": "XAUUSD",
    "direction": "SHORT",
    "timeframe": {
      "value": 30,
      "unit": "MINUTES"
    },
    "entry_zone": {
      "low": 4116,
      "high": 4129
    },
    "stop_loss": {
      "price": 4135
    },
    "take_profit_zones": [
      {
        "id": "TP1",
        "low": 4092,
        "high": 4104
      },
      {
        "id": "TP2",
        "low": 4016,
        "high": 4020
      }
    ]
  }
}
```

### Extended Metadata

Also include:

- `source`: Telegram chat/message IDs, raw prompt, source image asset ID
- `render`: template ID/version/output format
- `workflow`: status, created_at, approved_at, approved_by
- `extraction`: method (`deterministic` | `ai`), parser_version (if deterministic), or provider/model/prompt_version/guideline_version (if AI)
- `derived`: entry midpoint, risk distance, TP midpoints, risk/reward if desired

`extraction.method` is required on every signal. It is the field that lets you later measure, per the observability section, what fraction of signals ever needed AI at all — and it's what makes the AI evaluation dataset honest, since it lets you exclude signals the deterministic parser already handled correctly.

Do not hard-code only TP1/TP2 at the database level. Use an array so TP3/TP4 can be added later.

## Extraction Architecture

The `Extractor` port has two concrete implementations. Routing between them happens one level above both, in the pipeline's `PARSING` stage — neither implementation needs to know the other exists.

```ts
interface Extractor {
  extract(input: ExtractionInput): Promise<ExtractionResult>;
}
```

### Extraction Router

```text
if admin_text matches known grammar AND no image attached:
    use DeterministicParser
else:
    use AIExtractor
```

`DeterministicParser` itself can also emit `NEEDS_CLARIFICATION` (e.g. a required field is missing or a token doesn't match any known unit), which routes the same message to `AIExtractor` as a fallback rather than failing outright. Log which extractor was actually used on every signal (see `extraction.method` above) — this is a required observability field, not optional telemetry.

### Path A — `DeterministicParser`

A small grammar/regex-based parser for the expected admin shorthand:

```text
<DIRECTION> <SYMBOL> <VALUE><UNIT>
Entry: <LOW>-<HIGH>
SL: <PRICE>
TP<N>: <LOW>-<HIGH>
```

Properties:

- No network call, no cost, no latency beyond regex matching.
- Fully reproducible: identical input always produces identical output.
- Versioned (`parser_version`) exactly like a prompt or template — grammar changes are still changes to a canonical extraction path and must be auditable the same way.
- Never invoked when a chart image is attached, since the parser has no way to reconcile text against an image; that case always routes to AI.

### Path B — `AIExtractor`

Used only for freeform text, chart interpretation, or parser-flagged ambiguity. Internally still separated into three layers as originally designed:

### 1. System Instruction

Permanent extraction rules:

```text
You are a trading signal data extraction engine.

Convert administrator instructions into the TradingSignal schema.

The administrator's explicit numeric values are authoritative.
The source chart is contextual evidence only.

Never invent missing trading levels.
Never modify administrator-provided levels.

If required information is missing or ambiguous, return NEEDS_CLARIFICATION.

Return only the defined structured output.
```

### 2. Business Guideline

Configurable rules, for example:

- Required: symbol, direction, timeframe, entry, stop loss, at least one TP
- SHORT: SL normally above entry; TP normally below entry
- LONG: SL normally below entry; TP normally above entry

These are structural validation rules, not permission for AI to modify the signal.

### 3. Admin Prompt

Example:

```text
SHORT XAUUSD 30m
Entry: 4116-4129
SL: 4135
TP1: 4092-4104
TP2: 4016-4020
Use standard template.
```

The admin may also attach the source chart.

## Structured AI Output (AI Path Only)

Applies only when the router selects `AIExtractor`. Use strict JSON Schema / Structured Outputs.

Recommended initial strategy:

- Start with the strongest suitable vision/reasoning model.
- GPT-5.6 is a suitable starting point for the current OpenAI setup.
- Use image input with high/original detail when chart interpretation matters.
- Benchmark reasoning levels rather than assuming maximum is always better.
- Do not optimize prematurely for AI cost; reliability is more important at 3–5 signals/day.

For the sample image size (~724 × 946), image-token cost is small. At roughly 3–5 signals/day, reliability and operational robustness matter more than model cost.

## Deterministic Validation

Runs identically regardless of which extractor produced the canonical JSON — the deterministic parser's output is not exempt just because it came from a "trusted" path. Do not rely exclusively on AI.

Validate:

### Schema

- Required fields exist
- Correct data types
- Valid enums
- Numeric values are positive
- `low <= high`

### Directional Structure

For SHORT:

```text
SL > entry.high
TP1.high < entry.low
TP2.high < TP1.low
```

For LONG:

```text
SL < entry.low
TP1.low > entry.high
TP2.low > TP1.high
```

These rules should be configurable according to business requirements.

### Important Rule

Never silently correct invalid values. Return an explicit validation error.

### Derived Calculations

Perform simple calculations in application code, not with an LLM:

- entry midpoint
- risk distance
- TP distance
- risk/reward
- percentage distance

## Telegram Admin Workflow

Telegram is both the primary admin interface and approval interface.

1. **Submit:** Admin sends signal text and optionally a source chart.
2. **Authenticate:** Bot checks the Telegram admin allowlist.
3. **Parse:** Extraction router selects `DeterministicParser` or `AIExtractor`; whichever runs produces the canonical `TradingSignal`.
4. **Validate:** JSON Schema + deterministic validation.
5. **Render:** Generate standardized HTML card and PNG.
6. **Preview:** Bot sends PNG and buttons:
   - ✅ Confirm & Publish
   - ✏️ Edit
   - 🔄 Regenerate
   - ❌ Cancel
7. **Edit:** Example: `Change SL to 4137`. Only that field changes; create a new revision and rerender.
8. **Confirm:** Admin explicitly approves the current revision.
9. **Publish:** Publish to configured platforms.
10. **Report:** Report success/failure independently per platform.

### Telegram State Machine

```text
IDLE
  ↓
RECEIVING_SIGNAL
  ↓
PARSING            (Extraction Router → DeterministicParser or AIExtractor)
  ↓
VALIDATING
  ↓
RENDERING
  ↓
AWAITING_APPROVAL
  ├── CONFIRM → PUBLISHING
  ├── EDIT → EDITING → RENDERING
  ├── REGENERATE → RENDERING
  └── CANCEL → CANCELLED
```

Use webhooks in production, a secret webhook path, and an admin allowlist.

Environment variables:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
```

## HTML Rendering Architecture

Treat HTML as an internal rendering service:

```text
TradingSignal JSON
        │
        ▼
Presentation Model
        │
        ▼
HTML Template
        │
        ▼
Playwright / Chromium
        │
        ▼
PNG
```

Rules:

- AI does not control pixel coordinates.
- AI does not control fonts, colors, or layout.
- Templates are deterministic.
- Each template has `template_id` and `template_version`.
- Template versions should be immutable.
- Use visual regression tests against golden PNGs.

## Database Design

Recommended tables:

- `admin_users`
- `signals`
- `signal_revisions`
- `take_profit_zones`
- `source_assets`
- `rendered_assets`
- `templates`
- `template_versions`
- `jobs`
- `job_attempts`
- `publication_targets`
- `publication_jobs`
- `ai_requests`
- `ai_responses`
- `audit_events`
- `oauth_connections`

### `signals`

```text
id
schema_version
symbol
direction
timeframe_value
timeframe_unit
entry_low
entry_high
stop_loss
status
extraction_method   -- 'deterministic' | 'ai'
parser_version      -- set when extraction_method = 'deterministic'
created_at
updated_at
approved_at
approved_by
```

### `take_profit_zones`

```text
id
signal_id
sequence
low
high
```

### `source_assets`

```text
id
signal_id
storage_key
mime_type
filename
sha256
size_bytes
```

### `rendered_assets`

```text
id
signal_id
template_id
template_version
storage_key
mime_type
width
height
sha256
```

### `publication_jobs`

```text
id
signal_id
asset_id
platform
target_id
status
scheduled_at
started_at
completed_at
external_post_id
error_code
error_message
attempt_count
```

Note: `ai_requests` / `ai_responses` rows are only created when `extraction_method = 'ai'`. Signals handled by `DeterministicParser` have no rows in these tables — that absence is itself meaningful data (it's how you measure what fraction of volume never touched the model).

### `oauth_connections`

```text
id
platform
account_id
account_name
encrypted_access_token
encrypted_refresh_token
expires_at
scopes
status
```

## Internal API

Possible endpoints:

```text
POST /webhooks/telegram
POST /signals
GET  /signals/:id
PATCH /signals/:id

POST /signals/:id/validate
POST /signals/:id/render
POST /signals/:id/preview

POST /signals/:id/approve
POST /signals/:id/cancel
POST /signals/:id/publish

GET /signals/:id/publications
GET /templates
GET /distribution-profiles

POST /connections/x
POST /connections/meta
POST /connections/tiktok
```

## Background Jobs and Events

Jobs:

```text
route_extraction
parse_signal_deterministic
parse_signal_ai
validate_signal
render_signal
send_preview

publish_telegram
publish_x
publish_facebook
publish_instagram
publish_tiktok
```

Domain events:

```text
SignalCreated
SignalParsedDeterministically
SignalParsedByAI
SignalNeedsClarification
SignalValidationFailed
SignalValidated
RenderRequested
RenderCompleted
PreviewSent
SignalEdited
SignalApproved
PublicationRequested
PublicationStarted
PublicationSucceeded
PublicationFailed
```

### Idempotency

Use:

```text
signal_id + platform + target_id + content_revision
```

as the logical idempotency key so retries cannot create duplicate posts.

## Social Platform Adapters

Common interface:

```ts
interface Publisher {
  publish(input: PublishRequest): Promise<PublishResult>;
  validateConfiguration(): Promise<ConfigurationStatus>;
  getStatus(publicationId: string): Promise<PublicationStatus>;
}
```

Implement:

```text
TelegramPublisher
XPublisher
FacebookPublisher
InstagramPublisher
TikTokPublisher
```

The core signal pipeline should not contain platform-specific publishing logic.

### Telegram

Use the Bot API and `sendPhoto`. Store `chat_id` and `message_id`.

### X

Typical flow:

```text
PNG
 ↓
Media upload
 ↓
media_id
 ↓
Create post
 ↓
post_id
```

Store both `media_id` and `post_id`. Validate image constraints before upload.

### Facebook

Implement Facebook Page publishing rather than personal-profile publishing. Use Meta Graph API with the appropriate Page permissions and verify current API requirements during implementation.

### Instagram

Use a separate adapter despite shared Meta infrastructure.

Typical flow:

```text
PNG
 ↓
Publicly accessible asset URL
 ↓
Create media container
 ↓
Check processing status if required
 ↓
Publish media
```

Use Professional accounts and ensure the asset URL is accessible to Meta.

### TikTok

For a PNG-only MVP, use TikTok PHOTO publishing behind a feature flag.

Typical requirements:

- registered developer app
- Content Posting API product
- correct authorization scopes
- creator information query
- required app review/audit conditions

Do not assume public posting is available until required approval/audit is complete.

## Platform-Specific Captions

Do not put captions inside `TradingSignal`.

Keep facts separate from platform copy:

```json
{
  "content": {
    "telegram": {
      "caption": "..."
    },
    "x": {
      "text": "..."
    },
    "facebook": {
      "text": "..."
    },
    "instagram": {
      "caption": "..."
    },
    "tiktok": {
      "caption": "..."
    }
  }
}
```

AI may generate platform-specific copy, but it must never modify signal facts.

## Recommended Tech Stack

### Backend

- TypeScript
- Node.js
- Fastify
- grammY or Telegraf
- PostgreSQL
- Prisma or Drizzle

### Queue

- Redis
- BullMQ

Possible managed alternatives:

- AWS SQS
- Cloudflare Queues

### Rendering

- Playwright
- Chromium

### Storage

- S3-compatible object storage
- Cloudflare R2 as one option

### Infrastructure

- Docker
- GitHub Actions
- HTTPS

### Testing

- Vitest
- Playwright E2E
- visual regression testing

## Repository Structure

```text
signal-platform/
  apps/
    api/
    worker/
    renderer/
    web/

  packages/
    domain/
    schemas/
    extraction/        # router + shared Extractor interface
      parsing/          # DeterministicParser (grammar/regex)
      ai/               # AIExtractor (system/guideline/prompt layers)
    telegram/
    rendering/
    storage/
    database/
    logging/

    publishers/
      telegram/
      x/
      facebook/
      instagram/
      tiktok/

  templates/
    trading-signal/
      v1/

  tests/
  docker/
  scripts/
  prisma/

  .env.example
  docker-compose.yml
```

The `web` app can initially be omitted if there is no need for an internal dashboard.

## Testing Strategy

### Unit Tests

Extraction router:

- known-grammar text with no image → routes to `DeterministicParser`
- freeform prose → routes to `AIExtractor`
- known-grammar text with an image attached → routes to `AIExtractor`
- `DeterministicParser` returns `NEEDS_CLARIFICATION` → falls back to `AIExtractor`

`DeterministicParser` variations (should never invoke a network call):

```text
SHORT XAUUSD 30m Entry 4116-4129 SL 4135 TP1 4092-4104 TP2 4016-4020
short gold 30 minutes ...
malformed / partial input → NEEDS_CLARIFICATION, not a guess
```

`AIExtractor` (prompt-level) variations:

```text
short gold 30 minutes...
...
```

Validation cases:

- valid SHORT
- invalid SHORT with SL below entry
- missing SL
- missing TP
- reversed entry range
- invalid TP ordering

Also test:

- deterministic calculations
- state machine
- idempotency
- publisher request mapping

### Renderer Tests

Verify:

- HTML loads
- no browser console errors
- expected text exists
- expected dimensions
- no overflow
- no clipping
- visual output matches golden PNG

### AI Evaluation

Scope this dataset to signals that actually routed to `AIExtractor` (freeform text, chart interpretation, or flagged ambiguity). Signals handled by `DeterministicParser` don't belong in this dataset — they're covered by the deterministic parser's own unit tests instead, since blending the two would make field-level accuracy look better than the AI path actually performs on the cases that matter.

Build a dataset of approximately 100–200 real examples containing:

- source chart
- admin prompt
- expected JSON

Measure field-level accuracy:

```text
symbol
direction
timeframe
entry
SL
TP1
TP2
```

Do not rely only on an overall score.

Example release thresholds:

```text
symbol     >= 99.5%
direction  >= 99.5%
entry      >= 99%
SL         >= 99.5%
TP1        >= 99%
TP2        >= 99%
```

Tune thresholds using real production data. Schema compliance should be 100%.

## End-to-End Test

Primary E2E flow:

```text
Telegram input
    ↓
Webhook
    ↓
Extraction Router (Deterministic Parser or AI)
    ↓
Canonical JSON
    ↓
Schema validation
    ↓
Deterministic validation
    ↓
HTML renderer
    ↓
PNG
    ↓
Telegram preview
    ↓
Admin Confirm
    ↓
Telegram publication
    ↓
Publication record
```

Also test:

- well-formed shorthand text with no image → deterministic path only, zero AI calls, pipeline still completes end-to-end with OpenAI unreachable
- OpenAI unavailable
- renderer unavailable
- Telegram unavailable
- X unavailable
- Meta token expired
- TikTok not approved
- duplicate retry
- partial publication

## Quality Gateway

A signal cannot be published unless:

1. Extraction succeeds (deterministic parse or AI parse, per the router's choice).
2. JSON Schema validation succeeds.
3. Deterministic trading validation succeeds.
4. HTML rendering succeeds.
5. PNG exists.
6. PNG dimensions are correct.
7. Admin explicitly approves.
8. Publication target is enabled and authenticated.
9. No duplicate idempotency key exists.

## Security

Required controls:

- HTTPS
- Telegram admin allowlist
- secret webhook path
- encrypted OAuth tokens
- secrets in environment variables / secret manager
- never commit secrets to Git
- validate uploaded file MIME type and signature
- enforce image size limits
- enforce image dimension/decompression limits
- parameterized queries / ORM
- dependency scanning
- container scanning
- database backups
- private or temporary asset URLs where possible
- complete audit logging

## Deployment

At approximately 3–5 signals/day, Kubernetes is unnecessary.

### MVP Production Setup

```text
Cloudflare / HTTPS
       │
       ▼
      API
       │
   ┌───┴────┐
   ▼        ▼
 Worker   Renderer
   │
   ├── PostgreSQL
   ├── Redis
   └── Object Storage
```

A small VPS/container host can run API, worker, and renderer while PostgreSQL, Redis, and object storage are managed services.

For early staging, Docker Compose is sufficient.

### Environment Variables

```text
NODE_ENV
DATABASE_URL
REDIS_URL
OPENAI_API_KEY

TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET

STORAGE_ENDPOINT
STORAGE_BUCKET
STORAGE_ACCESS_KEY
STORAGE_SECRET_KEY

X_CLIENT_ID
X_CLIENT_SECRET

META_APP_ID
META_APP_SECRET

TIKTOK_CLIENT_KEY
TIKTOK_CLIENT_SECRET

BASE_URL
```

## Observability

Track:

- signals/day
- % of signals handled by `DeterministicParser` vs `AIExtractor`
- `DeterministicParser` → `NEEDS_CLARIFICATION` fallback rate
- AI extraction success rate
- field-level extraction accuracy (AI path only)
- validation failures
- render success rate
- render duration
- preview latency
- approval time
- publication success by platform
- retry count
- queue backlog
- AI cost
- token usage
- external API errors

Use structured JSON logs containing:

```text
request_id
signal_id
job_id
platform
timestamp
duration
status
error
```

Telegram can initially be used for operational alerts.

## Versioning

Store:

```text
schema_version
parser_version       (deterministic extraction grammar)
AI model
prompt_version
guideline_version
template_version
renderer_version
```

Example (AI path):

```json
{
  "extraction": {
    "method": "ai",
    "provider": "openai",
    "model": "gpt-5.6",
    "prompt_version": "signal-extractor-v3",
    "guideline_version": "trading-guideline-v2"
  },
  "render": {
    "template_version": "1.4"
  }
}
```

Example (deterministic path):

```json
{
  "extraction": {
    "method": "deterministic",
    "parser_version": "shorthand-grammar-v1"
  },
  "render": {
    "template_version": "1.4"
  }
}
```

This enables reproducible and auditable outputs regardless of which extractor ran.

## Revision Model

Never mutate approved history.

```text
Signal v1
    ↓ edit
Signal v2
    ↓ edit
Signal v3
    ↓ approve
```

Each revision stores:

- structured JSON snapshot
- editor/admin
- timestamp
- change information where appropriate

## Future-Proofing

Use a generic content model above the trading-signal model:

```text
Content
  ├── TradingSignal
  ├── MarketAnalysis
  ├── EducationalPost
  ├── Announcement
  └── Promotion
```

This allows the platform to evolve into a broader content automation engine.

## Build Phases

### Phase 1 — Working MVP

Build only the complete vertical slice:

```text
Telegram
  ↓
Extraction Router (DeterministicParser | AIExtractor)
  ↓
Canonical TradingSignal
  ↓
Validation
  ↓
HTML
  ↓
PNG
  ↓
Telegram Preview
  ↓
Approval
  ↓
Telegram Publication
```

Build the `DeterministicParser` and the router alongside the AI path from day one, not as a later optimization — it's what keeps the MVP usable when OpenAI is unavailable, and it's a small amount of code relative to the rest of the pipeline. Focus on reliability before adding other platforms.

### Phase 2

Add:

- revisions/editing
- template management
- AI captions
- X
- Facebook
- Instagram

### Phase 3

Add:

- TikTok
- scheduled publishing
- multiple distribution profiles
- analytics
- internal admin dashboard

### Phase 4

Expand into:

- multiple content types
- multiple templates
- multilingual output
- video generation
- carousel generation
- analytics
- reposting
- campaign automation

## Definition of Done

The coding agent should not consider the system complete merely because the server starts.

The system is complete when:

1. Admin sends source image + natural-language signal to Telegram.
2. Bot authenticates the admin.
3. The extraction router selects the correct path, and whichever extractor runs (deterministic or AI) returns strict structured data.
4. JSON Schema validation passes.
5. Deterministic trading validation passes.
6. HTML renderer produces the correct standardized card.
7. Playwright exports the PNG.
8. Bot sends the PNG preview plus signal summary.
9. Admin can Confirm, Edit, Regenerate, or Cancel.
10. Confirm triggers distribution.
11. Successful and failed platforms are tracked independently.
12. Retry cannot duplicate successful publications.
13. Inputs, outputs, events, approvals, and version metadata are auditable.
14. Unit, integration, E2E, visual-regression, and AI evaluation tests pass.
15. CI/CD blocks deployment when quality gates fail.

## Most Important Architectural Rules

1. **`TradingSignal` JSON is the single source of truth.**
2. **Explicit admin values override chart interpretation.**
3. **AI extracts/structures; it does not silently invent or change trading parameters.**
4. **HTML is a renderer, not a data store.**
5. **PNG is an asset, not the canonical object.**
6. **No publication without deterministic validation and explicit human approval.**
7. **Every social platform is an adapter.**
8. **Every publication is idempotent and auditable.**
9. **Every prompt/model/template/schema is versioned.**
10. **Start modular, not microservices; scale components only when justified.**
11. **Extraction is deterministic-first: AI is a fallback for freeform text, chart interpretation, and ambiguity — not the default path for values the admin already typed explicitly.**

## Recommended First Milestone

Do **not** build the entire multi-platform system first.

Build a production-quality vertical slice:

> **Telegram → Extraction Router (Deterministic Parser / OpenAI) → validated `TradingSignal` → HTML → PNG → Telegram approval → Telegram publication**

Once that path is stable and the AI evaluation dataset demonstrates reliable field-level extraction, add X/Meta/TikTok adapters without changing the core signal pipeline.
