---
feature: 001-rate-limit-login
stage: 4
persona: D
status: accepted
branch: feat/001-rate-limit-login
---

# 04 · Build plan — Rate-limit login attempts

## Feedback loop
```sh
npm test -- --grep "001"
npm run lint
npm run typecheck
```

## Slices

### Slice 1 — Account limit end-to-end
- Mode: AFK
- Blocked by: none
- Covers: REQ-1, REQ-3, REQ-4, DR-1, DR-3
- Files: `src/gateway/rateLimiter.ts`, `src/gateway/routes/login.ts`, `src/gateway/config.ts`
- Steps:
  1. Create `rateLimiter.check` with account key only; TTL 600 s.
  2. Call it first in `login.ts`; on `!allowed` return constant 429 body with `Retry-After`.
  3. Add `RATE_LIMIT_ACCOUNT=5` to config.
- Verify: `npm test -- --grep "REQ-1|REQ-3|REQ-4|DR-1|DR-3"`

### Slice 2 — IP limit
- Mode: AFK
- Blocked by: Slice 1
- Covers: REQ-2
- Files: `src/gateway/rateLimiter.ts`, `src/gateway/config.ts`
- Steps:
  1. Add ip key to the same pipeline; `RATE_LIMIT_IP=50`.
- Verify: `npm test -- --grep "REQ-2"`

### Slice 3 — Telemetry and fail-open
- Mode: AFK
- Blocked by: Slice 1
- Covers: NFR-2, DR-2
- Files: `src/gateway/limitTelemetry.ts`, `src/gateway/rateLimiter.ts`
- Steps:
  1. Emit `login_rate_limited_total{kind}` and structured log on limit.
  2. Catch cache errors → allow + `login_rate_limit_error_total`.
- Verify: `npm test -- --grep "NFR-2|DR-2"`

### Slice 4 — Latency check
- Mode: HITL
- Blocked by: Slice 2, Slice 3
- Covers: NFR-1
- Files: `tests/perf/login-rate-limit.perf.ts`
- Steps:
  1. Run the perf test against staging; record p95.
- Verify: `npm run perf -- login-rate-limit`

## Parallel plan
Slice 2 and Slice 3 may run in parallel after Slice 1. Slice 4 runs last, with a human watching.

Build progress is recorded in `04-build-log.md`.
