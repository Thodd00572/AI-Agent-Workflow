# Rollback — Rate-limit login attempts

## Trigger
`login_rate_limit_error_total` > 0 for 5 min, or login p95 latency rises > 5 ms, or legitimate-user 429 reports.

## Steps
1. Flip `rate_limit_login=false`. Effect is immediate; no redeploy.
2. If the flag path itself fails, redeploy previous `api-gateway` image.
3. Counters in cache expire by themselves within 10 min; nothing to clean.

## Rehearsal
2026-10-22, staging: flag flipped to false under load; limiting stopped within 2 s; no errors. Result: pass.
