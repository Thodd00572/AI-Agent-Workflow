---
name: adlc-gate
description: Walk the human through accepting an ADLC gate — run the deterministic checks, present the judgement checklist from adlc/gates.md, and give the approve command. Use when the user says "gate", "accept stage N", "review before approve", or "is this ready".
disable-model-invocation: true
---

# /adlc-gate

Usage: `/adlc-gate <feature> G<n>`.

## Steps

1. Run `node scripts/adlc.mjs check <feature>`. Show the output verbatim.
2. Open `adlc/gates.md`. Present the **human judgement** column for this gate as a short checklist.
3. Open the stage artefact. For each checklist item, point the human to the exact section that answers it. Do not answer for them.
4. For G6 and G7, launch `adlc-critic` (read-only, fresh context) with the diff and the artefacts 03 and 04; include its findings.
5. If any deterministic check failed, say which persona must fix it and stop.
6. If all deterministic checks pass, print:
   ```
   To accept: node scripts/adlc.mjs approve <feature> G<n>
   ```
   and stop. **You never run this command.**

## If the human rejects
Ask which artefact is wrong. Explain that reopening an earlier gate makes downstream approvals stale (`adlc status` will show it). Append a line to `adlc/lessons.md` describing what escaped and what should change (rule line, check, or template).
