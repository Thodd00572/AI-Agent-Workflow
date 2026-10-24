# AI Agent Workflow

**One human owns one feature. Six agent personas prepare the work. The human accepts every gate. Tests exist before the feature code. One feature folder carries the context.**

This repository is **AI Agent Workflow**. The operating model it demonstrates is **ADLC (Agent Development Life Cycle)** — a small, tool-agnostic path for building software with AI agents. It is not a framework you install; it is a path you follow, a folder layout that carries context, and a handful of deterministic checks that keep agents inside their job.

This repository contains:

| Part | Where | What it is |
|---|---|---|
| The concept site | `site/` | Static website that explains the whole model (open `site/index.html`) |
| The model | `adlc/` | Personas A–F, stage templates, gate definitions, autonomy ladder, lessons |
| The skeleton | `.cursor/`, `AGENTS.md` | Rules, skills and subagents so Cursor (or any agent) runs the path |
| The CLI | `scripts/adlc.mjs` | Zero-dependency commands: `new`, `status`, `check`, `approve` |
| A worked example | `features/001-rate-limit-login/` | One feature carried through all eight stages |
| Tests | `tests/` | `node --test` coverage for the CLI gates |

## Quick start

```sh
git clone https://github.com/Thodd00572/AI-Agent-Workflow.git && cd AI-Agent-Workflow
npm run site            # open http://localhost:4173
npm test                # run gate tests

node scripts/adlc.mjs new my-feature         # creates features/002-my-feature
node scripts/adlc.mjs status 002             # where the feature is on the path
node scripts/adlc.mjs check 002              # deterministic checks for the current stage
node scripts/adlc.mjs approve 002 G1         # human records acceptance of stage 1
```

Inside Cursor, type `/adlc-new`, `/adlc-stage`, `/adlc-gate`. The skills read the files in the feature folder, never chat memory.

## The path

```
1 Requirement ─G1→ 2 Architecture ─G2→ 3 Design ─G3→ 4 Build plan ─G4→
5 Test plan (tests first, red) ─G5→ 6 Build ─G6→ 7 Verify ─G7→ 8 Release ─G8
```

Each stage is run by one persona, in a fresh context, from the files in the feature folder. Each stage ends when the human accepts the gate. A gate approval is bound to a hash of the artefact; if the artefact changes, the approval goes stale and must be renewed.

## The six personas

| | Persona | Produces | Hands back to the human when |
|---|---|---|---|
| A | Product Owner | `01-requirement.md` | Scope or value still needs a product decision |
| B | System Architect | `02-system-map.md` | A dependency is unknown, or the change crosses a domain |
| C | Solution Designer | `03-solution-design.md` | Security review or an integration owner still needs to respond |
| D | Build Lead | `04-build-plan.md`, then code in a branch + `04-build-log.md` | The repository does not match the accepted design |
| E | Quality Engineer | `05-test-plan/`, then `06-test-summary.md` | A requirement has no test, or the evidence is incomplete |
| F | Delivery Lead | `07-change-pack/` | A required approval is still with a person |

The same model can play all six. The persona keeps each one inside its job.

## What stays human

Agents read approved sources, draft artefacts, generate code and tests in a branch, and report gaps. They do not decide scope, grant an architecture exception, sign off security, merge to a protected branch, accept UAT for the business, or approve production.

Autonomy grows only where evidence supports it: **Shadow → Assist → Act → Scale**. New adopters start at Assist (agents draft, humans accept everything).

## Principles behind the design

1. **Small tasks, fresh context.** Each stage is one session that reads files. No stage relies on chat memory. (Smart zone, not dumb zone.)
2. **Align before artefact.** Stage 1 interviews the human until the requirement is testable. Specs-to-code without alignment is vibe coding by another name.
3. **Tests before code.** Stage 5 writes failing tests from the requirement and design. Stage 6 makes them pass without redesigning stage 3.
4. **Vertical slices.** The build plan cuts tracer bullets across layers, so every slice is demonstrable and parallelisable.
5. **Deterministic over prose.** Anything that is 1 + 1 = 2 becomes a script in `adlc check`, not a paragraph in a rule.
6. **No defect escapes twice.** Every escaped defect becomes a lesson, a rule line, or a new check.

## Layout

```
AI-Agent-Workflow/
├── AGENTS.md                 # entry point any agent reads first
├── .cursor/
│   ├── rules/                # thin, always-on guidance
│   ├── skills/               # adlc-new, adlc-stage, adlc-gate
│   └── agents/               # adlc-builder, adlc-verifier, adlc-critic
├── adlc/
│   ├── personas/             # A–F: role, knowledge, outputs, stop conditions
│   ├── templates/            # 01…07 artefact templates
│   ├── gates.md              # G1…G8 acceptance checklists
│   ├── autonomy.md           # Shadow / Assist / Act / Scale
│   └── lessons.md            # append-only; feeds rules and checks
├── features/
│   └── 001-rate-limit-login/ # worked example
├── scripts/adlc.mjs          # CLI
├── site/                     # the concept website
└── tests/                    # node --test
```

## Adopting ADLC in an existing project

Copy `adlc/`, `.cursor/`, `scripts/adlc.mjs` and `AGENTS.md` into your repository. Edit `adlc/personas/B-system-architect.md` with your landscape and `.cursor/rules/stack.mdc` with your stack. Run the first feature at **Assist**. After a few features, read `adlc/lessons.md` and decide which persona may move to **Act**.

License: MIT.
