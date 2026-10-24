---
feature: {{FEATURE}}
stage: 3
persona: C
status: draft
---

# 03 · Solution design — {{TITLE}}

## Modules
Deep modules: small interface, substantial behaviour, testable from the outside.

| Module | New / Changed | Interface (one line) | Tested as a unit? |
|---|---|---|---|

## Interfaces
For each module: signature, inputs, outputs, failure modes. Match the repository's style.

## Data and state
Schema changes, migrations, backfill, retention.

## Errors
| Failure | Behaviour | Surfaced to |
|---|---|---|

## Security
Authn/authz, validation, secrets, sensitive logging, abuse cases.

## Performance and capacity
Load, limits, caching, timeouts, idempotency. Tie to `NFR-` ids.

## Design rules
Numbered; stage 5 tests them, stage 7 maps them.

- **DR-1** …
- **DR-2** …

## Requirement coverage
| ID | Module / Rule |
|---|---|
| REQ-1 | |
| NFR-1 | |

## Integration asks
Questions another team or a reviewer must answer. The gate stays closed while any owner is open.

| Ask | Owner | Status |
|---|---|---|

## Deviations
Accepted departures from 01 or 02, with the human's reason.

## Open questions
- (none)
