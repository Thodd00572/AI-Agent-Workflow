# Lessons

Append-only. One line per lesson. Each lesson becomes **one** of: a line in a rule, a new check in `scripts/adlc.mjs`, or a change to a template. Mechanical lessons become checks; judgement lessons become rule lines. Nothing becomes a paragraph.

Format: `YYYY-MM-DD · stage:N · feature · what escaped · what we changed`

- 2026-10-23 · stage:5 · 001-rate-limit-login · a REQ had no test and nobody noticed until verify · `adlc check` G5 now fails when any id lacks a test mapping
- 2026-10-23 · stage:6 · 001-rate-limit-login · build started before tests were red · `adlc check` G6 now requires G5 approval timestamp before first build-log entry
- 2026-10-23 · stage:1 · 001-rate-limit-login · "fast" accepted as a requirement · template now shows an NFR with a number; rule line added: "no adjective without a number"
