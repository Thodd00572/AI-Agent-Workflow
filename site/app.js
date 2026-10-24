(() => {
  const { stages, personas, autonomy, humanOnly } = window.ADLC;
  const $ = (s, el = document) => el.querySelector(s);
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  };

  // ---------- The path ----------
  const path = $('#path');
  const detail = $('#step-detail');
  let active = 1;

  function renderPath() {
    path.replaceChildren();
    const top = stages.slice(0, 4), bottom = stages.slice(4).reverse();
    const row = (list, cls) => {
      const r = h('div', { class: `path-row ${cls}` });
      list.forEach((s, i) => {
        r.append(h('button', {
          class: `step${s.n === active ? ' is-active' : ''}`, type: 'button',
          'aria-pressed': s.n === active, 'data-n': s.n, onclick: () => select(s.n),
        }, h('span', { class: 'step-circle' }, String(s.n)), h('span', { class: 'step-name' }, s.name)));
        if (i < list.length - 1) {
          const from = cls === 'top' ? s : list[i + 1];
          r.append(h('div', { class: 'edge' }, h('span', { class: 'edge-label' }, from.gate)));
        }
      });
      return r;
    };
    const mid = h('div', { class: 'path-turn' },
      h('span', { class: 'edge-label vertical' }, 'G4 · TESTS FIRST'));
    path.append(row(top, 'top'), mid, row(bottom, 'bottom'));
  }

  function renderDetail() {
    const s = stages.find((x) => x.n === active);
    detail.replaceChildren(
      h('div', { class: 'detail-head' },
        h('div', { class: 'detail-persona' }, `${s.persona} · ${s.personaName}`),
        h('div', { class: 'detail-mode mono' }, s.mode)),
      h('h3', {}, `${s.n}. ${s.name}`),
      h('p', { class: 'detail-produces' }, s.produces),
      h('code', { class: 'detail-file' }, `features/NNN-slug/${s.file}`),
      h('p', { class: 'detail-does' }, s.does),
      h('div', { class: 'detail-cols' },
        h('div', {}, h('h4', {}, `${s.gate} · adlc check`), h('ul', { class: 'checks' }, s.checks.map((c) => h('li', {}, c)))),
        h('div', {}, h('h4', {}, `${s.gate} · human judgement`), h('p', {}, s.human))),
      h('p', { class: 'detail-stop' }, s.stop),
    );
  }

  function select(n) {
    active = n;
    renderPath();
    renderDetail();
    history.replaceState(null, '', `#step-${n}`);
  }

  document.addEventListener('keydown', (e) => {
    if (!$('#path').matches(':hover') && !document.activeElement?.closest('#path')) return;
    if (e.key === 'ArrowRight') select(Math.min(8, active + 1));
    if (e.key === 'ArrowLeft') select(Math.max(1, active - 1));
  });
  $('#step-prev').addEventListener('click', () => select(Math.max(1, active - 1)));
  $('#step-next').addEventListener('click', () => select(Math.min(8, active + 1)));

  const m = location.hash.match(/step-(\d)/);
  if (m) active = Number(m[1]);
  renderPath();
  renderDetail();

  // ---------- Personas ----------
  const pg = $('#personas');
  personas.forEach((p) => pg.append(
    h('article', { class: 'persona' },
      h('div', { class: 'persona-id' }, p.id),
      h('h3', {}, p.name),
      h('p', { class: 'persona-defines' }, `Defines ${p.defines}.`),
      h('dl', {},
        h('dt', {}, 'Produces'), h('dd', {}, p.produces),
        h('dt', {}, 'Hands back when'), h('dd', {}, p.back),
        h('dt', {}, 'Never'), h('dd', {}, p.never)))));

  // ---------- Autonomy ----------
  const at = $('#autonomy tbody');
  autonomy.forEach((a) => at.append(h('tr', {},
    h('th', { scope: 'row' }, a.level), h('td', {}, a.may), h('td', {}, a.human), h('td', {}, a.up))));

  const ho = $('#human-only');
  humanOnly.forEach((t) => ho.append(h('li', {}, t)));

  // ---------- Copy buttons ----------
  document.querySelectorAll('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
    const code = btn.parentElement.querySelector('code, pre')?.innerText ?? '';
    try { await navigator.clipboard.writeText(code); btn.textContent = 'Copied'; setTimeout(() => (btn.textContent = 'Copy'), 1200); } catch { /* ignore */ }
  }));

  // ---------- Year ----------
  $('#year').textContent = new Date().getFullYear();
})();
