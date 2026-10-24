---
feature: 001-rate-limit-login
stage: 3
persona: C
status: accepted
---

# 03 · Solution design — Rate-limit login attempts

## Modules

| Module | New / Changed | Interface (one line) | Tested as a unit? |
|---|---|---|---|
| `rateLimiter` | New (deep) | `check({accountHash, ip}) → {allowed, retryAfterSec, kind}` | yes |
| `loginRoute` | Changed | calls `rateLimiter.check` before provider; maps result to 429 | integration |
| `limitTelemetry` | New | `record(kind, ip, accountHash)` → metric + log | yes |

## Interfaces
```ts
type Kind = 'account' | 'ip';
interface Decision { allowed: boolean; retryAfterSec?: number; kind?: Kind }
rateLimiter.check(input: { accountHash: string; ip: string }): Promise<Decision>
```
- Uses a pipelined `INCR` + `EXPIRE NX` on two keys; one round-trip.
- On cache error: **fail open** (allow) and record `login_rate_limit_error_total`. Availability of login is prioritised over strictness; security accepted this (see Integration asks).

## Data and state
Keys `rl:acct:<sha256(accountId)>` and `rl:ip:<ip>`, integer counters, TTL 600 s set on first increment. No migration.

## Errors
| Failure | Behaviour | Surfaced to |
|---|---|---|
| Cache unavailable | allow; error metric | Observability |
| Malformed IP | treat as `unknown`, count under IP bucket `unknown` | nobody (logged) |
| Limit exceeded | `429`, `Retry-After: <sec>`, fixed body | Client |

## Security
- Account id never logged or keyed raw; hashed with the existing `hashIdentifier()` helper.
- Response body and timing identical for existing and non-existing accounts (REQ-4): the limiter runs **before** account lookup.
- Limits read from config; no runtime endpoint to change them.

## Performance and capacity
- NFR-1: one pipelined cache call ≈ 1 ms p95 in current cluster; budget 5 ms.
- Counters expire; memory bound ≈ (unique accounts + unique IPs in 10 min) × ~60 B.

## Design rules
- **DR-1** The limiter runs before any account lookup or provider call.
- **DR-2** Cache failure fails open and increments an error metric; it never throws to the client.
- **DR-3** The 429 body is a constant; it never includes the limit kind, the threshold, or whether the account exists.

## Requirement coverage
| ID | Module / Rule |
|---|---|
| REQ-1 | `rateLimiter` account key |
| REQ-2 | `rateLimiter` ip key |
| REQ-3 | TTL 600 s |
| REQ-4 | DR-1, DR-3 |
| NFR-1 | pipelined single round-trip |
| NFR-2 | `limitTelemetry` |

## Integration asks
| Ask | Owner | Status |
|---|---|---|
| Accept fail-open on cache error | Security lead | answered: accepted, with error metric alert |
| Dashboard panel for new metric | Observability | answered: will add after merge |

## Deviations
- (none)

## Open questions
- (none)
