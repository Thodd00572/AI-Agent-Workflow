import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const cli = path.join(repo, 'scripts', 'adlc.mjs');

let root;
before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adlc-'));
  fs.cpSync(path.join(repo, 'adlc', 'templates'), path.join(root, 'adlc', 'templates'), { recursive: true });
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

const run = (...args) => {
  const r = spawnSync(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
};
const fpath = (...p) => path.join(root, 'features', '001-demo', ...p);
const write = (rel, content) => { fs.mkdirSync(path.dirname(fpath(rel)), { recursive: true }); fs.writeFileSync(fpath(rel), content); };

test('new creates a numbered feature folder from templates with placeholders filled', () => {
  const r = run('new', 'demo', '--title', 'Demo Feature');
  assert.equal(r.code, 0, r.out);
  assert.ok(fs.existsSync(fpath('01-requirement.md')));
  assert.ok(fs.existsSync(fpath('07-change-pack', 'rollback.md')));
  const md = fs.readFileSync(fpath('01-requirement.md'), 'utf8');
  assert.match(md, /feature: 001-demo/);
  assert.match(md, /Demo Feature/);
  assert.doesNotMatch(md, /\{\{/);
  const gates = JSON.parse(fs.readFileSync(fpath('gates.json'), 'utf8'));
  assert.equal(gates.autonomy.A, 'assist');
});

test('new rejects a slug that is not kebab-case', () => {
  assert.notEqual(run('new', 'Bad Slug').code, 0);
});

test('G1 fails on an unfilled template (REQ lines still have …)', () => {
  const r = run('check', '001', 'G1');
  assert.equal(r.code, 1);
  assert.match(r.out, /REQ lines are filled in/);
});

test('approve refuses when deterministic checks fail', () => {
  const r = run('approve', '001', 'G1');
  assert.notEqual(r.code, 0);
  assert.match(r.out, /checks fail/);
  assert.ok(!JSON.parse(fs.readFileSync(fpath('gates.json'), 'utf8')).gates.G1);
});

const requirement = `---
feature: 001-demo
stage: 1
---
# 01 · Requirement — Demo
## Problem
People wait.
## Scope
### In scope
- thing
### Out of scope
- other thing
## Acceptance criteria
- **REQ-1** Given a user, when they click, then it works.
- **REQ-2** Given nothing, when idle, then nothing happens.
## Non-functional needs
- **NFR-1** p95 < 100 ms at 10 rps
## Open questions
- (none)
`;

test('G1 passes on a filled requirement and approve records a hash', () => {
  write('01-requirement.md', requirement);
  assert.equal(run('check', '001', 'G1').code, 0);
  const r = run('approve', '001', 'G1', '--by', 'tester');
  assert.equal(r.code, 0, r.out);
  const g = JSON.parse(fs.readFileSync(fpath('gates.json'), 'utf8'));
  assert.equal(g.gates.G1.by, 'tester');
  assert.match(g.gates.G1.hash, /^[a-f0-9]{64}$/);
});

test('G1 keeps the gate closed while an open question exists', () => {
  write('01-requirement.md', requirement.replace('- (none)', '- Which users?'));
  const r = run('check', '001', 'G1');
  assert.equal(r.code, 1);
  assert.match(r.out, /1 open/);
  write('01-requirement.md', requirement);
});

test('editing an approved artefact makes the gate stale', () => {
  write('01-requirement.md', requirement + '\nextra line\n');
  const r = run('status', '001');
  assert.match(r.out, /G1\s+stale/);
  assert.match(r.out, /warning: a stale gate/);
  write('01-requirement.md', requirement);
  assert.match(run('status', '001').out, /G1\s+approved/);
});

test('approve enforces order: G3 cannot be approved before G2', () => {
  const r = run('approve', '001', 'G3');
  assert.notEqual(r.code, 0);
  assert.match(r.out, /G2 must be approved/);
});

test('G2 fails when a REQ from 01 is not referenced', () => {
  write('02-system-map.md', `# 02\n## Where it fits\nREQ-1 only\n## Dependencies\n| a | b |\n## Open questions\n- (none)\n`);
  const r = run('check', '001', 'G2');
  assert.equal(r.code, 1);
  assert.match(r.out, /missing REQ-2, NFR-1/);
});

test('G5 requires every id to map to a test and a red run', () => {
  write('02-system-map.md', `# 02\n## Where it fits\nREQ-1 REQ-2 NFR-1\n## Dependencies\n| a | b |\n## Open questions\n- (none)\n`);
  assert.equal(run('approve', '001', 'G2').code, 0);
  write('03-solution-design.md', `# 03\n## Modules\nREQ-1 REQ-2 NFR-1\n## Design rules\n- **DR-1** rule\n## Integration asks\n| Ask | Owner | Status |\n|---|---|---|\n| x | y | answered |\n## Open questions\n- (none)\n`);
  assert.equal(run('approve', '001', 'G3').code, 0);
  write('04-build-plan.md', `# 04\n## Feedback loop\nnpm test\n## Slices\n### Slice 1 — a\n- Covers: REQ-1\n- Files: x\n- Verify: y\n`);
  assert.equal(run('approve', '001', 'G4').code, 0);

  write('05-test-plan/README.md', `# 05\n## Mapping\n| REQ-1 | t | n | unit |\n| NFR-1 | t | n | perf |\n| DR-1 | t | n | unit |\n## Red run\n\`\`\`\n0 passing, 3 failing\n\`\`\`\n`);
  let r = run('check', '001', 'G5');
  assert.equal(r.code, 1);
  assert.match(r.out, /missing REQ-2/);

  write('05-test-plan/README.md', `# 05\n## Mapping\n| REQ-1 | t | n | unit |\n| REQ-2 | t | n | unit |\n| NFR-1 | t | n | perf |\n| DR-1 | t | n | unit |\n## Red run\n\`\`\`\nall green\n\`\`\`\n`);
  r = run('check', '001', 'G5');
  assert.equal(r.code, 1);
  assert.match(r.out, /records a red/);

  write('05-test-plan/README.md', `# 05\n## Mapping\n| REQ-1 | t | n | unit |\n| REQ-2 | t | n | unit |\n| NFR-1 | t | n | perf |\n| DR-1 | t | n | unit |\n## Red run\n\`\`\`\n0 passing, 4 failing\n\`\`\`\n`);
  assert.equal(run('approve', '001', 'G5').code, 0);
});

test('G6 requires a build log entry per planned slice', () => {
  write('04-build-log.md', `# log\n## Build log\n- (none yet)\n`);
  let r = run('check', '001', 'G6');
  assert.equal(r.code, 1);
  write('04-build-log.md', `# log\n## Build log\n- Slice 1 · abc · tests pass\n`);
  r = run('check', '001', 'G6');
  assert.equal(r.code, 0, r.out);
  assert.equal(run('approve', '001', 'G6').code, 0);
});

test('G7 requires evidence and explicit acceptance of non-pass ids', () => {
  write('06-test-summary.md', `# 06\n## Results\n| ID | Test | Result | Evidence |\n|---|---|---|---|\n| REQ-1 | t | pass | e/1 |\n| REQ-2 | t | fail | e/2 |\n| NFR-1 | t | pass | e/3 |\n| DR-1 | t | pass | e/4 |\n## Gaps\n- (none)\n`);
  let r = run('check', '001', 'G7');
  assert.equal(r.code, 1);
  assert.match(r.out, /explicitly accepted in Gaps \(REQ-2\)/);
  write('06-test-summary.md', `# 06\n## Results\n| ID | Test | Result | Evidence |\n|---|---|---|---|\n| REQ-1 | t | pass | e/1 |\n| REQ-2 | t | fail | e/2 |\n| NFR-1 | t | pass | e/3 |\n| DR-1 | t | pass | e/4 |\n## Gaps\n- REQ-2 accepted by owner: ships behind flag, fix in 002\n`);
  assert.equal(run('check', '001', 'G7').code, 0);
});

test('re-approving an earlier gate drops downstream approvals', () => {
  const r = run('approve', '001', 'G1', '--by', 'tester');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /dropped G2/);
  const g = JSON.parse(fs.readFileSync(fpath('gates.json'), 'utf8'));
  assert.ok(g.gates.G1);
  assert.ok(!g.gates.G2);
  assert.ok(!g.gates.G6);
});

test('the shipped example feature passes every gate', () => {
  const r = spawnSync(process.execPath, [cli, 'status', '001-rate-limit-login'], { encoding: 'utf8', cwd: repo });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /all gates approved/);
  for (const g of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8']) {
    const c = spawnSync(process.execPath, [cli, 'check', '001-rate-limit-login', g], { encoding: 'utf8', cwd: repo });
    assert.equal(c.status, 0, `${g}\n${c.stdout}${c.stderr}`);
  }
});
