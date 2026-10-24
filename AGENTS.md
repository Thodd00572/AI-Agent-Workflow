# AGENTS.md — how agents work in this repository

This is **AI Agent Workflow**. It follows **ADLC (Agent Development Life Cycle)**. Read this file first, then the feature folder you are asked to work on. Do not rely on chat memory; the files are the memory.

## The path

```
1 Requirement → 2 Architecture → 3 Design → 4 Build plan → 5 Test plan → 6 Build → 7 Verify → 8 Release
```

A feature lives in `features/NNN-slug/` and carries these artefacts, in order:

```
01-requirement.md      02-system-map.md       03-solution-design.md
04-build-plan.md       04-build-log.md        05-test-plan/
06-test-summary.md     07-change-pack/        gates.json (written by scripts/adlc.mjs)
```

## Who does what

| Stage | Persona file | Artefact |
|---|---|---|
| 1 | `adlc/personas/A-product-owner.md` | `01-requirement.md` |
| 2 | `adlc/personas/B-system-architect.md` | `02-system-map.md` |
| 3 | `adlc/personas/C-solution-designer.md` | `03-solution-design.md` |
| 4 | `adlc/personas/D-build-lead.md` | `04-build-plan.md` |
| 5 | `adlc/personas/E-quality-engineer.md` | `05-test-plan/` (tests fail before code) |
| 6 | `adlc/personas/D-build-lead.md` | code in a branch, following 04; `04-build-log.md` |
| 7 | `adlc/personas/E-quality-engineer.md` | `06-test-summary.md` |
| 8 | `adlc/personas/F-delivery-lead.md` | `07-change-pack/` |

## Hard rules

1. **One stage per session.** Run the stage you were asked for. Produce its artefact. Stop. Do not start the next stage.
2. **Read upstream, never redesign upstream.** Stage 6 follows 04 and 03. If the repository does not match the accepted design, stop and report; do not quietly redesign.
3. **Tests before feature code.** Stage 5 must exist and fail before stage 6 begins. `node scripts/adlc.mjs check <feature>` enforces this.
4. **Stop conditions are real.** Every persona has a "hands back to the human when" list. When one triggers, write the gap into the artefact under `## Open questions` and stop.
5. **Humans accept gates.** Never run `adlc approve`. Never merge to a protected branch. Never mark a gate accepted in prose.
6. **Trace everything.** Requirements carry IDs (`REQ-1`, `NFR-1`). Design rules carry IDs (`DR-1`). Tests reference them. The test summary maps every ID to a result.
7. **Surgical edits.** Touch only files the build plan names. Match existing style. Mention unrelated problems; do not fix them.
8. **Lessons compound.** When a defect escapes a gate, append to `adlc/lessons.md`. If it is mechanical, propose a new check in `scripts/adlc.mjs` instead of a longer rule.

## Commands

```sh
node scripts/adlc.mjs new <slug>              # new feature folder from templates
node scripts/adlc.mjs status <feature>        # current stage and gate states
node scripts/adlc.mjs check <feature>         # deterministic checks; exit 1 on failure
node scripts/adlc.mjs approve <feature> G<n>  # HUMAN ONLY
npm test                                      # tests for the CLI itself
```

## Skills available in Cursor

- `/adlc-new` — create a feature folder and run the stage 1 interview.
- `/adlc-stage` — run one stage with the right persona and template.
- `/adlc-gate` — walk the human through accepting a gate.

Subagents: `adlc-builder` (one slice, TDD), `adlc-verifier` (run tests, write summary), `adlc-critic` (read-only review in a fresh context).
