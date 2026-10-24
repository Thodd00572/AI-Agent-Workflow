# Deploy — Rate-limit login attempts

## Pre-checks
- Cache cluster healthy; memory headroom > 30 %.
- Config `RATE_LIMIT_ACCOUNT=5`, `RATE_LIMIT_IP=50`, `RATE_LIMIT_WINDOW_SEC=600` present in all environments.

## Steps
1. Deploy `api-gateway` with flag `rate_limit_login=false`.
2. Verify error rate unchanged for 10 min.
3. Flip flag to `true` for 10 % of traffic; watch `login_rate_limited_total` and `login_rate_limit_error_total`.
4. Flip to 100 %.

## Configuration / flags
- `rate_limit_login` (boolean, default false)

## Migrations
- None.

## Monitoring to watch (first 30 min)
- `login_rate_limited_total{kind}` — expect non-zero, no spike > 5 % of attempts.
- `login_rate_limit_error_total` — expect 0.
- Login p95 latency — expect < +5 ms.
