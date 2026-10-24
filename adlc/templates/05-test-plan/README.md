---
feature: {{FEATURE}}
stage: 5
persona: E
status: draft
---

# 05 · Test plan — {{TITLE}}

Tests are written **before** the feature code. They must fail on the first run.

## Mapping
Every `REQ-`, `NFR-` and `DR-` id has at least one test.

| ID | Test file | Test name | Kind |
|---|---|---|---|
| REQ-1 | `tests/…` | | unit / integration / e2e / perf / security |

## Failure, security and performance cases
- Invalid input:
- Auth bypass:
- Limits / timeouts:
- Concurrency:

## Red run
Paste the failing run. The gate requires it.

```
$ npm test
… N failing
```

## Notes for the builder
Fixtures, factories, env vars the tests expect.
