---
feature: 001-rate-limit-login
stage: 5
persona: E
status: accepted
---

# 05 · Test plan — Rate-limit login attempts

Tests were written before the feature code and failed on first run.

## Mapping

| ID | Test file | Test name | Kind |
|---|---|---|---|
| REQ-1 | `tests/gateway/rateLimiter.test.ts` | REQ-1 6th failed attempt on one account → 429, provider not called | unit |
| REQ-2 | `tests/gateway/rateLimiter.test.ts` | REQ-2 51st failed attempt from one IP → 429 | unit |
| REQ-3 | `tests/gateway/rateLimiter.test.ts` | REQ-3 after TTL expiry the next attempt is allowed | unit |
| REQ-4 | `tests/gateway/login.int.test.ts` | REQ-4 429 body identical for existing and unknown account | integration |
| NFR-1 | `tests/perf/login-rate-limit.perf.ts` | NFR-1 p95 added latency < 5 ms at 200 rps | perf |
| NFR-2 | `tests/gateway/limitTelemetry.test.ts` | NFR-2 metric incremented and log has hash + ip, no raw id | unit |
| DR-1 | `tests/gateway/login.int.test.ts` | DR-1 limiter runs before account lookup | integration |
| DR-2 | `tests/gateway/rateLimiter.test.ts` | DR-2 cache error → allowed, error metric incremented | unit |
| DR-3 | `tests/gateway/login.int.test.ts` | DR-3 429 body is a constant without kind or threshold | integration |

## Failure, security and performance cases
- Invalid input: malformed IP header → counted under `unknown`.
- Auth bypass: limiter cannot be skipped by omitting account field (counts IP).
- Limits / timeouts: cache timeout 50 ms → fail open (DR-2).
- Concurrency: 100 parallel attempts on one account → at most 5 reach the provider stub.

## Red run
```
$ npm test -- --grep "001"
  rateLimiter
    ✗ REQ-1 6th failed attempt on one account → 429, provider not called
    ✗ REQ-2 51st failed attempt from one IP → 429
    ✗ REQ-3 after TTL expiry the next attempt is allowed
    ✗ DR-2 cache error → allowed, error metric incremented
  login route
    ✗ REQ-4 429 body identical for existing and unknown account
    ✗ DR-1 limiter runs before account lookup
    ✗ DR-3 429 body is a constant without kind or threshold
  limitTelemetry
    ✗ NFR-2 metric incremented and log has hash + ip, no raw id

  0 passing, 8 failing  (module ./rateLimiter not found)
```

## Notes for the builder
- Cache is stubbed with `tests/helpers/fakeRedis.ts` (supports INCR, EXPIRE, pipeline, injectable error).
- Provider is stubbed with `tests/helpers/providerSpy.ts`; assert `calls.length`.
- Perf test runs only with `PERF=1` against staging.
