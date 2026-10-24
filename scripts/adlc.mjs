#!/usr/bin/env node
// ADLC CLI — zero dependencies.
//   node scripts/adlc.mjs new <slug> [--title "..."]
//   node scripts/adlc.mjs status <feature>
//   node scripts/adlc.mjs check <feature> [G<n>]
//   node scripts/adlc.mjs approve <feature> G<n>     (human only)
// Optional: --root <dir> to operate on another repository layout.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- args ----------
const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; }
    else flags[key] = true;
  } else positional.push(a);
}
const ROOT = path.resolve(flags.root ?? path.join(__dirname, '..'));
const FEATURES = path.join(ROOT, 'features');
const TEMPLATES = path.join(ROOT, 'adlc', 'templates');

// ---------- stage model ----------
export const STAGES = [
  { n: 1, gate: 'G1', name: 'Requirement',  persona: 'A', artefact: '01-requirement.md' },
  { n: 2, gate: 'G2', name: 'Architecture', persona: 'B', artefact: '02-system-map.md' },
  { n: 3, gate: 'G3', name: 'Design',       persona: 'C', artefact: '03-solution-design.md' },
  { n: 4, gate: 'G4', name: 'Build plan',   persona: 'D', artefact: '04-build-plan.md' },
  { n: 5, gate: 'G5', name: 'Test plan',    persona: 'E', artefact: '05-test-plan' },
  { n: 6, gate: 'G6', name: 'Build',        persona: 'D', artefact: '04-build-log.md' },
  { n: 7, gate: 'G7', name: 'Verify',       persona: 'E', artefact: '06-test-summary.md' },
  { n: 8, gate: 'G8', name: 'Release',      persona: 'F', artefact: '07-change-pack' },
];

// ---------- helpers ----------
const exists = (p) => fs.existsSync(p);
const read = (p) => (exists(p) ? fs.readFileSync(p, 'utf8') : '');
const die = (msg, code = 1) => { console.error(`error: ${msg}`); process.exit(code); };

function hashPath(p) {
  const h = crypto.createHash('sha256');
  if (!exists(p)) return null;
  const st = fs.statSync(p);
  if (st.isFile()) { h.update(fs.readFileSync(p)); return h.digest('hex'); }
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full); else files.push(full);
    }
  })(p);
  for (const f of files) { h.update(path.relative(p, f)); h.update('\0'); h.update(fs.readFileSync(f)); h.update('\0'); }
  return h.digest('hex');
}

function resolveFeature(ref) {
  if (!ref) die('feature required (e.g. 001 or 001-slug)');
  if (!exists(FEATURES)) die(`no features directory at ${FEATURES}`);
  const dirs = fs.readdirSync(FEATURES).filter((d) => fs.statSync(path.join(FEATURES, d)).isDirectory());
  const hit = dirs.find((d) => d === ref) ?? dirs.find((d) => d.startsWith(ref + '-')) ?? dirs.find((d) => d.startsWith(ref));
  if (!hit) die(`feature "${ref}" not found in ${FEATURES}`);
  return { name: hit, dir: path.join(FEATURES, hit) };
}

function loadGates(fdir) {
  const p = path.join(fdir, 'gates.json');
  return exists(p) ? JSON.parse(read(p)) : { feature: path.basename(fdir), gates: {}, autonomy: {} };
}
function saveGates(fdir, data) {
  fs.writeFileSync(path.join(fdir, 'gates.json'), JSON.stringify(data, null, 2) + '\n');
}

function section(md, heading) {
  // returns body text of "## heading" until next "## "
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.trim().toLowerCase().startsWith(`## ${heading.toLowerCase()}`));
  if (start === -1) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}
const ids = (md, prefixes) => {
  const re = new RegExp(`\\b(?:${prefixes.join('|')})-\\d+\\b`, 'g');
  return [...new Set(md.match(re) ?? [])];
};
const listItems = (body) =>
  (body ?? '').split('\n').map((l) => l.trim()).filter((l) => /^[-*] /.test(l)).map((l) => l.replace(/^[-*] /, ''))
    .filter((l) => !/^\(none\)/i.test(l));

// ---------- checks ----------
// Each check returns { ok, msg }.
function gateChecks(fdir, gate) {
  const r01 = read(path.join(fdir, '01-requirement.md'));
  const r03 = read(path.join(fdir, '03-solution-design.md'));
  const reqIds = ids(r01, ['REQ', 'NFR']);
  const drIds = ids(r03, ['DR']);
  const allIds = [...reqIds, ...drIds];
  const checks = [];
  const add = (ok, msg) => checks.push({ ok: !!ok, msg });
  const noPlaceholders = (md, file) => add(!/\{\{[A-Z_]+\}\}/.test(md), `${file}: no template placeholders left`);
  const noOpenQuestions = (md, file) => {
    const items = listItems(section(md, 'Open questions'));
    add(items.length === 0, `${file}: no open questions (${items.length} open)`);
  };

  switch (gate) {
    case 'G1': {
      const f = '01-requirement.md';
      add(r01.length > 0, `${f} exists`);
      if (!r01) break;
      noPlaceholders(r01, f);
      add(reqIds.filter((i) => i.startsWith('REQ')).length > 0, `${f}: at least one REQ- id`);
      const reqLines = r01.split('\n').filter((l) => /\*\*REQ-\d+\*\*/.test(l));
      add(reqLines.every((l) => !l.includes('…')), `${f}: REQ lines are filled in (no …)`);
      add(section(r01, 'Out of scope') !== null || /### Out of scope/i.test(r01), `${f}: has Out of scope`);
      const nfrLines = r01.split('\n').filter((l) => /\*\*NFR-\d+\*\*/.test(l));
      add(nfrLines.every((l) => /\d/.test(l.replace(/NFR-\d+/, ''))), `${f}: every NFR has a number`);
      noOpenQuestions(r01, f);
      break;
    }
    case 'G2': {
      const f = '02-system-map.md';
      const md = read(path.join(fdir, f));
      add(md.length > 0, `${f} exists`);
      if (!md) break;
      noPlaceholders(md, f);
      const missing = reqIds.filter((i) => !md.includes(i));
      add(missing.length === 0, `${f}: references every REQ/NFR${missing.length ? ' (missing ' + missing.join(', ') + ')' : ''}`);
      add(section(md, 'Dependencies') !== null, `${f}: has Dependencies`);
      noOpenQuestions(md, f);
      break;
    }
    case 'G3': {
      const f = '03-solution-design.md';
      add(r03.length > 0, `${f} exists`);
      if (!r03) break;
      noPlaceholders(r03, f);
      add(drIds.length > 0, `${f}: at least one DR- id`);
      const missing = reqIds.filter((i) => !r03.includes(i));
      add(missing.length === 0, `${f}: references every REQ/NFR${missing.length ? ' (missing ' + missing.join(', ') + ')' : ''}`);
      const asks = section(r03, 'Integration asks') ?? '';
      const open = asks.split('\n').filter((l) => /^\|/.test(l) && /\|\s*(open|pending|waiting)\s*\|?/i.test(l));
      add(open.length === 0, `${f}: no open integration asks (${open.length} open)`);
      noOpenQuestions(r03, f);
      break;
    }
    case 'G4': {
      const f = '04-build-plan.md';
      const md = read(path.join(fdir, f));
      add(md.length > 0, `${f} exists`);
      if (!md) break;
      noPlaceholders(md, f);
      const slices = md.split(/^### Slice /m).slice(1);
      add(slices.length > 0, `${f}: at least one slice (${slices.length})`);
      add(slices.every((s) => /Files:/.test(s) && /Verify:/.test(s)), `${f}: every slice has Files: and Verify:`);
      add(slices.every((s) => /Covers:\s*\S/.test(s)), `${f}: every slice covers at least one id`);
      add(section(md, 'Feedback loop') !== null, `${f}: has Feedback loop`);
      break;
    }
    case 'G5': {
      const f = '05-test-plan/README.md';
      const md = read(path.join(fdir, f));
      add(md.length > 0, `${f} exists`);
      if (!md) break;
      noPlaceholders(md, f);
      const missing = allIds.filter((i) => !md.includes(i));
      add(missing.length === 0, `${f}: every REQ/NFR/DR id maps to a test${missing.length ? ' (missing ' + missing.join(', ') + ')' : ''}`);
      const red = section(md, 'Red run') ?? '';
      add(/fail/i.test(red) && /\d/.test(red), `${f}: records a red (failing) run`);
      break;
    }
    case 'G6': {
      const f = '04-build-log.md';
      const md = read(path.join(fdir, f));
      const g = loadGates(fdir);
      add(!!g.gates.G5?.approvedAt, 'G5 (tests first) approved before build');
      add(md.length > 0, `${f} exists`);
      if (!md) break;
      noPlaceholders(md, f);
      const log = listItems(section(md, 'Build log'));
      add(log.length > 0, `${f}: Build log has entries (${log.length})`);
      add(log.some((l) => /pass|green|ok/i.test(l)), `${f}: Build log records a green feedback loop`);
      const plan = read(path.join(fdir, '04-build-plan.md'));
      const sliceCount = plan.split(/^### Slice /m).length - 1;
      add(log.length >= sliceCount, `${f}: every planned slice has a log entry (${log.length}/${sliceCount})`);
      break;
    }
    case 'G7': {
      const f = '06-test-summary.md';
      const md = read(path.join(fdir, f));
      add(md.length > 0, `${f} exists`);
      if (!md) break;
      noPlaceholders(md, f);
      const results = section(md, 'Results') ?? '';
      const rows = results.split('\n').filter((l) => /^\|\s*(REQ|NFR|DR)-\d+/.test(l));
      const covered = rows.map((l) => l.match(/(REQ|NFR|DR)-\d+/)[0]);
      const missing = allIds.filter((i) => !covered.includes(i));
      add(missing.length === 0, `${f}: every id has a result row${missing.length ? ' (missing ' + missing.join(', ') + ')' : ''}`);
      add(rows.every((l) => /\|\s*(pass|fail|untested)\s*\|/i.test(l)), `${f}: every row has pass/fail/untested`);
      add(rows.every((l) => { const cells = l.split('|').map((c) => c.trim()).filter(Boolean); return cells.length >= 4 && cells[3].length > 0; }), `${f}: every row has evidence`);
      const gaps = listItems(section(md, 'Gaps'));
      const notPass = rows.filter((l) => !/\|\s*pass\s*\|/i.test(l)).map((l) => l.match(/(REQ|NFR|DR)-\d+/)[0]);
      const unaccepted = notPass.filter((id) => !gaps.some((gl) => gl.includes(id) && /accepted/i.test(gl)));
      add(unaccepted.length === 0, `${f}: every non-pass id is explicitly accepted in Gaps${unaccepted.length ? ' (' + unaccepted.join(', ') + ')' : ''}`);
      break;
    }
    case 'G8': {
      const dir = path.join(fdir, '07-change-pack');
      for (const need of ['deploy.md', 'rollback.md', 'uat.md', 'approvals.md']) add(exists(path.join(dir, need)), `07-change-pack/${need} exists`);
      const uat = read(path.join(dir, 'uat.md'));
      const reqOnly = reqIds.filter((i) => i.startsWith('REQ'));
      const missing = reqOnly.filter((i) => !uat.includes(i));
      add(missing.length === 0, `uat.md: every REQ walked${missing.length ? ' (missing ' + missing.join(', ') + ')' : ''}`);
      const rb = read(path.join(dir, 'rollback.md'));
      add(/\d{4}-\d{2}-\d{2}/.test(section(rb, 'Rehearsal') ?? ''), 'rollback.md: rehearsal recorded with a date');
      const ap = read(path.join(dir, 'approvals.md'));
      const apRows = ap.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*-+/.test(l) && !/^\|\s*Approval/i.test(l));
      add(!apRows.some((l) => /\|\s*pending\s*\|/i.test(l)), 'approvals.md: no pending approvals');
      add(!apRows.some((l) => /delivery lead|\|\s*F\s*\|/i.test(l)), 'approvals.md: F (Delivery Lead) is not an approver');
      break;
    }
    default:
      die(`unknown gate ${gate}`);
  }
  return checks;
}

function gateState(fdir, stage) {
  const g = loadGates(fdir);
  const rec = g.gates[stage.gate];
  const art = path.join(fdir, stage.artefact);
  const present = exists(art);
  if (!rec) return { state: present ? 'ready' : 'missing', rec };
  const now = hashPath(art);
  return { state: now === rec.hash ? 'approved' : 'stale', rec };
}

function currentStage(fdir) {
  for (const s of STAGES) {
    const { state } = gateState(fdir, s);
    if (state !== 'approved') return s;
  }
  return null; // all done
}

// ---------- commands ----------
function cmdNew() {
  const slug = positional[1];
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) die('slug required, kebab-case (e.g. rate-limit-login)');
  if (!exists(TEMPLATES)) die(`templates not found at ${TEMPLATES}`);
  fs.mkdirSync(FEATURES, { recursive: true });
  const nums = fs.readdirSync(FEATURES).map((d) => parseInt(d.slice(0, 3), 10)).filter((n) => !Number.isNaN(n));
  const next = String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
  const name = `${next}-${slug}`;
  const title = typeof flags.title === 'string' ? flags.title : slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  const dest = path.join(FEATURES, name);
  fs.mkdirSync(dest);
  (function copy(src, dst) {
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, e.name), d = path.join(dst, e.name);
      if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copy(s, d); }
      else fs.writeFileSync(d, fs.readFileSync(s, 'utf8').replaceAll('{{FEATURE}}', name).replaceAll('{{TITLE}}', title));
    }
  })(TEMPLATES, dest);
  saveGates(dest, {
    feature: name, title, created: new Date().toISOString(),
    autonomy: { A: 'assist', B: 'assist', C: 'assist', D: 'assist', E: 'assist', F: 'assist' },
    gates: {},
  });
  console.log(`created features/${name}`);
  console.log(`next: run stage 1 as Product Owner → ${name}/01-requirement.md, then: adlc approve ${next} G1`);
}

function cmdStatus() {
  const { name, dir } = resolveFeature(positional[1]);
  const g = loadGates(dir);
  console.log(`${name} — ${g.title ?? ''}`);
  console.log(`autonomy: ${Object.entries(g.autonomy ?? {}).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  console.log('');
  for (const s of STAGES) {
    const { state, rec } = gateState(dir, s);
    const mark = { approved: '✓', stale: '!', ready: '·', missing: ' ' }[state];
    const when = rec?.approvedAt ? ` ${rec.approvedAt.slice(0, 10)} by ${rec.by ?? '?'}` : '';
    console.log(`${mark} ${s.n} ${s.name.padEnd(13)} ${s.gate}  ${state.padEnd(8)} ${s.persona}  ${s.artefact}${when}`);
  }
  const cur = currentStage(dir);
  console.log('');
  console.log(cur ? `current stage: ${cur.n} ${cur.name} (persona ${cur.persona}) → gate ${cur.gate}` : 'all gates approved — feature complete');
  if (STAGES.some((s) => gateState(dir, s).state === 'stale')) console.log('warning: a stale gate means its artefact changed after approval; renew with adlc approve');
}

function runChecks(dir, gate) {
  const checks = gateChecks(dir, gate);
  for (const c of checks) console.log(`${c.ok ? '  ✓' : '  ✗'} ${c.msg}`);
  return checks.every((c) => c.ok);
}

function cmdCheck() {
  const { name, dir } = resolveFeature(positional[1]);
  const target = positional[2] ?? currentStage(dir)?.gate;
  if (!target) { console.log(`${name}: all gates approved`); return; }
  if (!STAGES.some((s) => s.gate === target)) die(`unknown gate ${target}`);
  console.log(`${name} · ${target}`);
  const ok = runChecks(dir, target);
  console.log(ok ? `\n${target}: deterministic checks pass — human judgement next (see adlc/gates.md)` : `\n${target}: FAIL`);
  process.exit(ok ? 0 : 1);
}

function cmdApprove() {
  const { name, dir } = resolveFeature(positional[1]);
  const gate = positional[2];
  const stage = STAGES.find((s) => s.gate === gate);
  if (!stage) die('gate required, G1..G8');
  if (stage.n > 1) {
    const prev = STAGES[stage.n - 2];
    const { state } = gateState(dir, prev);
    if (state !== 'approved') die(`${prev.gate} must be approved (currently ${state}) before ${gate}`);
  }
  console.log(`${name} · ${gate}`);
  if (!runChecks(dir, gate)) die(`${gate} deterministic checks fail; fix the artefact first`);
  const g = loadGates(dir);
  g.gates[gate] = {
    approvedAt: new Date().toISOString(),
    by: flags.by ?? process.env.USER ?? process.env.USERNAME ?? 'human',
    hash: hashPath(path.join(dir, stage.artefact)),
    artefact: stage.artefact,
  };
  // approving an earlier gate again makes later approvals untrustworthy: drop them
  for (const s of STAGES) if (s.n > stage.n && g.gates[s.gate]) { delete g.gates[s.gate]; console.log(`  dropped ${s.gate} (downstream of re-approved ${gate})`); }
  saveGates(dir, g);
  console.log(`\n${gate} approved by ${g.gates[gate].by}. Next: stage ${stage.n + 1 <= 8 ? stage.n + 1 : '— done'}`);
}

const cmd = positional[0];
if (cmd === 'new') cmdNew();
else if (cmd === 'status') cmdStatus();
else if (cmd === 'check') cmdCheck();
else if (cmd === 'approve') cmdApprove();
else {
  console.log(`ADLC — Agent Development Life Cycle

  adlc new <slug> [--title "..."]   create features/NNN-slug from templates
  adlc status <feature>             stages, gate states, current stage
  adlc check <feature> [G<n>]       deterministic checks (exit 1 on fail)
  adlc approve <feature> G<n>       HUMAN ONLY — binds approval to artefact hash

  --root <dir>   operate on another repository`);
  process.exit(cmd ? 1 : 0);
}
