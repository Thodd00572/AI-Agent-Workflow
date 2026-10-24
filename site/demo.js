(() => {
  const canvas = document.getElementById('scene');
  const captionEl = document.getElementById('caption');
  const beats = [...document.querySelectorAll('#beats li')];
  const pauseBtn = document.getElementById('pause');
  const replayBtn = document.getElementById('replay');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const W = 390, H = 780;
  const ORANGE = '#ff4d1a';
  const LAYERS = [
    { name: 'REQUIREMENT',  sub: 'persona A · G1', color: '#e7e5e0' },
    { name: 'ARCHITECTURE', sub: 'persona B · G2', color: '#7dd3fc' },
    { name: 'DESIGN',       sub: 'persona C · G3', color: '#c4b5fd' },
    { name: 'BUILD PLAN',   sub: 'persona D · G4', color: '#fb923c' },
    { name: 'TEST PLAN',    sub: 'persona E · G5', color: '#4ade80' },
    { name: 'BUILD',        sub: 'persona D · G6', color: '#fdba74' },
    { name: 'VERIFY',       sub: 'persona E · G7', color: '#86efac' },
    { name: 'RELEASE',      sub: 'persona F · G8', color: '#f9a8d4' },
  ];

  const PHASES = [
    { id: 'void',  at: 0,    spawn: 2.4, catch: [0, 0, 0, 0, 0, 0, 0, 0],
      caption: 'A feature with no path falls straight to production.' },
    { id: 'late',  at: 5.2,  spawn: 2.1, catch: [0, 0, 0, 0, 0, 0.15, 0.45, 0.55],
      caption: 'Late gates appear. Verify and release start to intercept a few slices.' },
    { id: 'tests', at: 10.4, spawn: 2.5, catch: [0.14, 0.2, 0.24, 0.3, 0.88, 0.35, 0.42, 0.36],
      caption: 'Tests exist before the feature code. Most work is caught above production.' },
    { id: 'hold',  at: 17.2, spawn: 0.4, catch: [0.14, 0.2, 0.24, 0.3, 0.88, 0.35, 0.42, 0.36],
      caption: 'ADLC does not make agents faster. It makes production see less unproven work.' },
    { id: 'loop',  at: 20.5, spawn: 0,   catch: [0, 0, 0, 0, 0, 0, 0, 0], caption: '' },
  ];

  const railX0 = 148, railX1 = 338;
  const topPill = { x: W / 2, y: 168, w: 168, h: 36 };
  const botPill = { x: W / 2, y: 708, w: 168, h: 36 };
  const rails = LAYERS.map((L, i) => ({
    ...L,
    y: 230 + i * 52,
    flash: 0,
    warm: 0,
  }));

  const dots = [];
  let incidents = 0;
  let t = 0;
  let last = 0;
  let acc = 0;
  let running = !reduced;
  let phase = PHASES[0];
  let raf = 0;

  const ctx = canvas.getContext('2d');

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function phaseAt(time) {
    let p = PHASES[0];
    for (const next of PHASES) if (time >= next.at) p = next;
    return p;
  }

  function setPhase(p) {
    if (p.id === phase.id) return;
    phase = p;
    if (p.id === 'loop') return reset();
    captionEl.textContent = p.caption;
    beats.forEach((li) => li.classList.toggle('is-on', li.dataset.phase === p.id));
  }

  function spawn() {
    dots.push({
      x: topPill.x + (Math.random() - 0.5) * 28,
      y: topPill.y + 10,
      vx: (Math.random() - 0.5) * 18,
      vy: 70 + Math.random() * 40,
      r: 5.2,
      color: '#f5f5f5',
      caught: false,
      bounces: 0,
      life: 1,
    });
  }

  function step(dt) {
    t += dt;
    const p = phaseAt(t);
    setPhase(p);

    rails.forEach((r, i) => {
      const want = p.catch[i] > 0.08 ? 1 : 0;
      r.warm += (want - r.warm) * Math.min(1, dt * 2.4);
      r.flash = Math.max(0, r.flash - dt * 3.2);
    });

    acc += dt * p.spawn;
    while (acc >= 1) { spawn(); acc -= 1; }

    for (let i = dots.length - 1; i >= 0; i--) {
      const d = dots[i];
      const prevY = d.y;
      d.vy += 220 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= 0.995;
      if (d.caught) d.life -= dt * 0.22;

      for (let k = 0; k < rails.length; k++) {
        const r = rails[k];
        const on = d.x >= railX0 - 2 && d.x <= railX1 + 2;
        const cross = prevY < r.y && d.y >= r.y && d.vy > 0;
        if (!on || !cross || d.caught) continue;
        const rate = p.catch[k];
        if (rate > 0 && Math.random() < rate) {
          d.vy = -Math.abs(d.vy) * 0.58;
          d.vx += (Math.random() - 0.5) * 36;
          d.y = r.y - 0.4;
          d.color = r.color;
          d.bounces += 1;
          r.flash = 1;
          if (d.bounces >= 5 || Math.random() < 0.18) d.caught = true;
        } else if (rate < 0.1) {
          d.color = ORANGE;
        }
      }

      if (d.y > botPill.y - 8 && !d.caught) {
        incidents += 1;
        d.caught = true;
        d.life = 0;
      }
      if (d.x < railX0 + 6) d.vx = Math.abs(d.vx) * 0.6;
      if (d.x > railX1 - 6) d.vx = -Math.abs(d.vx) * 0.6;
      if (d.life <= 0 || d.y > H + 20) dots.splice(i, 1);
    }
  }

  function roundRect(x, y, w, h, r) {
    const l = x - w / 2, t = y - h / 2;
    ctx.beginPath();
    ctx.moveTo(l + r, t);
    ctx.arcTo(l + w, t, l + w, t + h, r);
    ctx.arcTo(l + w, t + h, l, t + h, r);
    ctx.arcTo(l, t + h, l, t, r);
    ctx.arcTo(l, t, l + w, t, r);
    ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#5a5956';
    ctx.font = '500 11px ui-monospace, SF Mono, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('@adlc', W / 2, 46);

    ctx.fillStyle = ORANGE;
    ctx.font = '700 42px "SF Pro Display", Inter, system-ui, sans-serif';
    ctx.fillText('ADLC Layers', W / 2, 98);

    ctx.fillStyle = '#161616';
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    roundRect(topPill.x, topPill.y, topPill.w, topPill.h, 18);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f3f1ec';
    ctx.font = '600 12px "SF Pro Display", Inter, system-ui, sans-serif';
    ctx.fillText('FEATURE  ·  slice', topPill.x, topPill.y + 4);

    rails.forEach((r) => {
      const warm = r.warm;
      const alpha = 0.28 + warm * 0.72 + r.flash * 0.3;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = warm > 0.25 ? r.color : '#3a3a38';
      ctx.lineWidth = 1.6 + r.flash * 1.2;
      ctx.setLineDash(warm > 0.25 ? [] : [3, 5]);
      ctx.beginPath();
      ctx.moveTo(railX0, r.y);
      ctx.lineTo(railX1, r.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(railX0, r.y - 4); ctx.lineTo(railX0, r.y + 4);
      ctx.moveTo(railX1, r.y - 4); ctx.lineTo(railX1, r.y + 4);
      ctx.stroke();
      ctx.restore();

      ctx.textAlign = 'right';
      ctx.fillStyle = warm > 0.25 ? r.color : '#8a8882';
      ctx.font = '600 10px "SF Pro Display", Inter, system-ui, sans-serif';
      ctx.fillText(r.name, railX0 - 14, r.y - 2);
      ctx.fillStyle = '#5c5b57';
      ctx.font = '500 9px ui-monospace, SF Mono, Menlo, monospace';
      ctx.fillText(r.sub, railX0 - 14, r.y + 11);
    });

    dots.forEach((d) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, d.life);
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 1.8;
      ctx.shadowColor = d.color;
      ctx.shadowBlur = d.color === '#f5f5f5' ? 0 : 8;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    ctx.fillStyle = '#161616';
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    roundRect(botPill.x, botPill.y, botPill.w, botPill.h, 18);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f3f1ec';
    ctx.font = '600 12px "SF Pro Display", Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PRODUCTION', botPill.x, botPill.y + 4);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#6a6964';
    ctx.font = '500 9px ui-monospace, SF Mono, Menlo, monospace';
    ctx.fillText('INCIDENTS', botPill.x + 98, botPill.y - 6);
    ctx.fillStyle = ORANGE;
    ctx.font = '700 28px "SF Pro Display", Inter, system-ui, sans-serif';
    ctx.fillText(String(incidents), botPill.x + 98, botPill.y + 16);
  }

  function reset() {
    t = 0;
    acc = 0;
    incidents = 0;
    dots.length = 0;
    rails.forEach((r) => { r.flash = 0; r.warm = 0; });
    phase = PHASES[0];
    captionEl.textContent = PHASES[0].caption;
    beats.forEach((li) => li.classList.toggle('is-on', li.dataset.phase === 'void'));
  }

  function frame(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (running) step(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function setRunning(v) {
    running = v;
    pauseBtn.textContent = running ? 'Pause' : 'Play';
  }

  pauseBtn.addEventListener('click', () => setRunning(!running));
  replayBtn.addEventListener('click', () => { reset(); setRunning(true); });
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') { e.preventDefault(); setRunning(!running); }
    if (e.key === 'r' || e.key === 'R') { reset(); setRunning(true); }
  });
  window.addEventListener('resize', fit);

  fit();
  reset();
  if (reduced) {
    phase = PHASES[2];
    rails.forEach((r, i) => { r.warm = PHASES[2].catch[i] > 0.08 ? 1 : 0; });
    incidents = 6;
    captionEl.textContent = PHASES[2].caption;
    beats.forEach((li) => li.classList.toggle('is-on', li.dataset.phase === 'tests'));
    draw();
  } else {
    raf = requestAnimationFrame(frame);
  }
})();
