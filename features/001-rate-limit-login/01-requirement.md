---
feature: 001-rate-limit-login
stage: 1
persona: A
status: accepted
---

# 01 · Requirement — Rate-limit login attempts

## Problem
Support sees bursts of thousands of failed logins per hour against a small set of accounts. Those accounts get locked by the downstream identity provider, and the owners call support. Today nothing slows an attacker down before the provider is hit.

## Users
- Primary: account owners who are being targeted (they should notice nothing).
- Secondary: support team (fewer lockout calls); security team (visibility).

## Scope
### In scope
- Limit failed login attempts per account and per source IP at the API edge.
- Return a clear, non-enumerating response when limited.
- Emit a metric and a structured log when a limit triggers.

### Out of scope
- CAPTCHA or step-up authentication.
- Changing the identity provider's own lockout policy.
- Admin UI for tuning limits (configuration file only in this feature).

## Acceptance criteria
- **REQ-1** Given an account with 5 failed logins within 10 minutes, when a 6th attempt arrives, then the API responds `429` with `Retry-After` and does not call the identity provider.
- **REQ-2** Given a source IP with 50 failed logins within 10 minutes across any accounts, when another attempt arrives, then the API responds `429` and does not call the identity provider.
- **REQ-3** Given a limited account or IP, when 10 minutes pass with no attempts, then the next attempt is processed normally.
- **REQ-4** Given a limited attempt, when the response is produced, then its body is identical for existing and non-existing accounts.

## Non-functional needs
- **NFR-1** Added p95 latency on the login path < 5 ms at 200 rps.
- **NFR-2** A limit trigger is visible as a metric within 60 s and as a log line containing account hash (not the account id) and source IP.

## Data
Counters keyed by hashed account id and by source IP, retained 10 minutes, in the existing cache. No new persistent store. No raw account ids in logs.

## Interview record
- Q: Limit per account, per IP, or both? → Both; attackers rotate either one.
- Q: Thresholds? → 5/account, 50/IP per 10 minutes; recommended as a starting point, tunable by config.
- Q: Lock out, or slow down? → Reject with 429 for the window; no permanent lock.
- Q: Should we tell the user which limit they hit? → No; identical body, to avoid account enumeration (REQ-4).
- Q: Backfill or reset existing provider locks? → Out of scope.
- Q: Where do counters live? → Existing cache; no new infrastructure.

## Open questions
- (none)
