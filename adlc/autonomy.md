# Autonomy ladder

Autonomy is granted **per persona**, **per project**, based on evidence from `adlc/lessons.md` and gate history. It is never granted globally.

| Level | Agent may | Human does | Move up when |
|---|---|---|---|
| **0 Shadow** | Observe. Read artefacts and code. Produce nothing that is kept. | Everything | A human has done the stage ≥3 times with the agent watching |
| **1 Assist** | Draft the artefact. Report gaps. Propose. | Reviews every line, accepts the gate | ≥5 features where the draft needed only minor edits |
| **2 Act** | Execute inside a sandbox or branch: write code, run tests, open a PR. | Accepts the gate from the evidence; reviews the diff | ≥5 features with zero escaped defects at that gate |
| **3 Scale** | Run the proven path on many features in parallel. | Accepts gates; samples diffs | The gate has a deterministic check for every defect class seen so far |

## Defaults for a new adopter

| Persona | Start at |
|---|---|
| A Product Owner | Assist |
| B System Architect | Assist |
| C Solution Designer | Assist |
| D Build Lead | Assist (stage 4) · Act in a branch (stage 6) |
| E Quality Engineer | Act in a branch (stage 5) · Assist (stage 7) |
| F Delivery Lead | Assist |

Record the current level in each feature's `gates.json` under `autonomy`. Lower it immediately when a defect escapes.

## What never moves up

Deciding scope. Granting an architecture exception. Signing off security. Merging to a protected branch. Accepting UAT for the business. Approving production. These stay human at every level.
