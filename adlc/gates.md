# Gates

A gate is the moment the **human engineer** accepts a stage. Agents prepare; humans accept. An approval is recorded by `node scripts/adlc.mjs approve <feature> G<n>` and bound to the SHA-256 of the stage artefact. If the artefact changes afterwards the approval becomes **stale** and must be renewed.

`adlc check` runs the deterministic part of each gate. The human runs the judgement part.

| Gate | Accepts | Deterministic (`adlc check`) | Human judgement |
|---|---|---|---|
| **G1** | 1 Requirement | `01-requirement.md` exists; has ≥1 `REQ-` id; has `## Out of scope`; no unanswered items under `## Open questions` | Is this the problem worth solving? Is the scope decided? |
| **G2** | 2 Architecture | `02-system-map.md` exists; every `REQ-` from 01 is referenced; has `## Dependencies` | Does it fit the landscape? Any exception needed? |
| **G3** | 3 Design | `03-solution-design.md` exists; has ≥1 `DR-` id; every `REQ-`/`NFR-` from 01 referenced; `## Integration asks` has no open owner | Has security responded? Are the modules deep enough? |
| **G4** | 4 Build plan | `04-build-plan.md` exists; has ≥1 `## Slice`; each slice lists `Files:` and `Verify:` | Are slices vertical? Is anything missing from 03? |
| **G5** | 5 Test plan | `05-test-plan/README.md` exists; every `REQ-`/`NFR-`/`DR-` id maps to a test; records a **red** run | Do the tests test the right thing? |
| **G6** | 6 Build | G5 approved **before** build; `04-build-log.md` has one entry per planned slice; feedback loop recorded green | Does the code follow 03 and 04? Review the diff. |
| **G7** | 7 Verify | `06-test-summary.md` exists; every id has a result; `## Gaps` is empty or each gap is accepted explicitly | Is the evidence real? Would you ship on it? |
| **G8** | 8 Release | `07-change-pack/` has `deploy.md`, `rollback.md`, `uat.md`; every `REQ-` appears in `uat.md` | All human approvals obtained. **F did not approve its own change.** |

## Reopening a gate

If a later stage shows an earlier artefact is wrong, the agent **stops and reports**. The human decides: reopen the earlier gate (edit the artefact, approvals downstream go stale) or accept a deviation (record it in the artefact under `## Deviations`). Agents never edit upstream artefacts on their own.

## Why hashes

Prose approvals rot. A hash-bound approval makes "accepted" a fact about a specific document, not a memory about a conversation.
