---
feature: {{FEATURE}}
stage: 4
persona: D
status: draft
branch: feat/{{FEATURE}}
---

# 04 · Build plan — {{TITLE}}

A PRP: enough for a fresh agent to build one slice without rediscovering the repository.

## Feedback loop
Commands that prove a slice. Run after every slice.

```sh
npm test
npm run lint
npm run typecheck
```

## Slices
Vertical. Each ends with something demonstrable. Mark blockers and mode.

### Slice 1 — {{short name}}
- Mode: AFK
- Blocked by: none
- Covers: REQ-1, DR-1
- Files: `path/to/file.ts`, `path/to/other.ts`
- Steps:
  1.
- Verify: `npm test -- --grep "REQ-1"`

### Slice 2 — {{short name}}
- Mode: AFK
- Blocked by: Slice 1
- Covers:
- Files:
- Steps:
- Verify:

## Parallel plan
Which slices may run at the same time by separate agents.

Stage 6 writes to `04-build-log.md`, not to this file, so G4 stays valid.
