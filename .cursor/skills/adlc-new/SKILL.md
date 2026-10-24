---
name: adlc-new
description: Start a new ADLC feature. Creates the feature folder from templates and runs the stage-1 interview as the Product Owner persona until the requirement is testable. Use when the user says "new feature", "start a feature", or gives a brief, ticket or idea to build.
disable-model-invocation: true
---

# /adlc-new

## Steps

1. Ask for a short slug (kebab-case) and a one-line title if not given.
2. Run:
   ```sh
   node scripts/adlc.mjs new <slug> --title "<title>"
   ```
   Note the created folder `features/NNN-slug/`.
3. Load `adlc/personas/A-product-owner.md`. You are now A.
4. Read the brief the user gave. Explore the repository for existing behaviour the brief touches (use the Explore subagent if the codebase is large).
5. **Interview.** One question at a time. Each question comes with your recommended answer. Cover: users, scope in/out, edge cases, failure behaviour, data, non-functional needs with numbers, definition of done. Stop only when nothing is undecided. Do not produce the artefact early.
6. Write `features/NNN-slug/01-requirement.md` from the template. Fill `## Interview record` with the decisions taken. Fill `## Open questions` with anything that needs a product decision.
7. Run `node scripts/adlc.mjs check NNN` and show the result.
8. Tell the user: "Stage 1 drafted. Review `01-requirement.md`; when you accept it, run `node scripts/adlc.mjs approve NNN G1`." Then stop. Do not start stage 2.

## Stop conditions (hand back)
- Scope or value needs a product decision you cannot infer.
- Two stakeholders would plausibly answer differently.
- A requirement cannot be made testable with the information available.
