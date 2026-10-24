---
name: adlc-stage
description: Run one ADLC stage (1–8) for a feature with the correct persona, template and upstream artefacts, then stop at the gate. Use when the user says "run stage N", "do the architecture / design / build plan / test plan / build / verify / release for feature X".
disable-model-invocation: true
---

# /adlc-stage

Usage: `/adlc-stage <feature> <stage>` — e.g. `/adlc-stage 001 3`.

## Steps

1. Run `node scripts/adlc.mjs status <feature>`. Confirm the previous gate is **approved** and not stale. If not, stop and tell the user which gate is open.
2. Load the persona for the stage (table in `.cursor/rules/adlc-flow.mdc`). You are now that persona and nobody else.
3. Read every approved upstream artefact in the feature folder. Read `adlc/lessons.md` entries tagged with this stage.
4. Read the relevant code. Design against the real repository, not an imagined one.
5. Produce the artefact from `adlc/templates/`. Keep all `REQ-`, `NFR-`, `DR-` ids and reference them.
   - Stage 5: write the tests in the project's test location, run them, paste the **red** run into `05-test-plan/README.md`.
   - Stage 6: pick one slice from `04-build-plan.md`; red → green → refactor; run the feedback loop; append to `## Build log` in `04-build-log.md`. For parallel slices, launch `adlc-builder` subagents, one per independent slice.
   - Stage 7: run everything; write `06-test-summary.md` with a result per id. Launch `adlc-critic` for a fresh-context review of the diff against 03 and 04.
6. If a stop condition from the persona triggers, write it under `## Open questions` and stop.
7. Run `node scripts/adlc.mjs check <feature>`. Fix deterministic failures that are yours to fix. Report the rest.
8. Tell the user which gate is now ready and the approve command. **Stop.** Do not begin the next stage.

## Never
- Edit an approved upstream artefact.
- Run `adlc approve`.
- Weaken a test to make it pass.
