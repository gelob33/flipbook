// visual show me — player.
//
// Loads ../specs/<name>.js (which sets window.VIZ), replays each step's ops into one
// snapshot per step, and hands each scene's (current, previous) snapshot to its view.
// Knows nothing about specific scene types: those come from the VSM registry.
(() => {
  'use strict';
  const { types, verbOwner, htmlEl, retrigger } = VSM;
  const PTR_COLORS = ['var(--sky)', 'var(--pink)', 'var(--lav)', 'var(--lemon)', 'var(--mint)', 'var(--peach)'];
  const $ = (sel) => document.querySelector(sel);

  // ---------- state: replay ops into one snapshot per step ----------
  function applyOp(spec, st, op) {
    if ('var' in op) { // global variable, shown in the variables panel
      if (op.value == null) delete st.vars[op.var]; else st.vars[op.var] = op.value;
      return;
    }
    const verb = Object.keys(op).find((k) => k in verbOwner);
    if (!verb) throw new Error(`unknown op ${JSON.stringify(op)}`);
    const type = types[verbOwner[verb]];
    const target = type.target(verb, op);
    const def = spec.scene[target];
    if (!def) throw new Error(`${JSON.stringify(op)} targets unknown scene "${target}"`);
    if (verbOwner[verb] !== def.type) throw new Error(`"${verb}" can't be used on ${def.type} scene "${target}"`);
    type.apply(st.scenes[target], verb, op, def);
  }

  function snapshots(spec, steps, label) {
    let st = { vars: {}, scenes: {} };
    for (const [id, def] of Object.entries(spec.scene)) st.scenes[id] = types[def.type].state(def);
    return steps.map((step, i) => {
      st = structuredClone(st);
      try {
        for (const op of step.do || []) applyOp(spec, st, op);
      } catch (e) {
        throw new Error(`${label}step ${i + 1}: ${e.message}`);
      }
      return st;
    });
  }

  // ---------- player ----------
  function init(spec, params) {
    if (!spec || !spec.scene) throw new Error('Spec needs a "scene" object');
    for (const [id, def] of Object.entries(spec.scene)) {
      if (!types[def.type]) throw new Error(`Scene "${id}": unknown type "${def.type}" (have: ${Object.keys(types).join(', ')})`);
    }
    const scenarios = spec.scenarios || [{ name: '', steps: spec.steps }];
    for (const sc of scenarios) {
      if (!Array.isArray(sc.steps) || !sc.steps.length) throw new Error(`Scenario "${sc.name}" needs a non-empty "steps" array`);
      sc.snaps = snapshots(spec, sc.steps, sc.name ? `Scenario "${sc.name}", ` : '');
    }
    const allSnaps = scenarios.flatMap((sc) => sc.snaps);

    document.title = spec.title || 'visual show me';
    $('#title').textContent = spec.title || '';
    $('#subtitle').textContent = spec.subtitle || '';

    const colors = {};
    let ci = 0;
    const colorOf = (name) => (colors[name] ??= PTR_COLORS[ci++ % PTR_COLORS.length]);

    // one sticker panel per scene, on the stage or in the side column
    const views = Object.entries(spec.scene).map(([id, def]) => {
      const type = types[def.type];
      const where = (def.place || type.place) === 'side' ? $('#side-panels') : $('#stage');
      const panel = htmlEl('div', `panel sticker panel-${def.type}`, where);
      if (def.title && def.type !== 'card') htmlEl('h2', 'panel-title', panel).textContent = def.title;
      const ctx = { snaps: allSnaps.map((st) => st.scenes[id]), colorOf };
      return { id, view: type.View(id, def, panel, ctx) };
    });

    // code panel
    const code = $('#code'), bar = $('#bar');
    if (spec.code && spec.code.length) {
      for (const text of spec.code) htmlEl('div', 'line', code).textContent = text;
    } else {
      code.hidden = true;
    }

    // variables panel: chips from views (e.g. array pointers), then plain vars
    const chipsFor = (st) => [
      ...views.flatMap(({ id, view }) => (view.chips ? view.chips(st.scenes[id]) : [])),
      ...Object.entries(st.vars).map(([k, v]) => [`var.${k}`, `${k} = ${v}`, null]),
    ];
    const varsEl = $('#vars');
    varsEl.hidden = !allSnaps.some((st) => chipsFor(st).length);
    const chips = new Map();
    function renderVars(st, animate) {
      const entries = chipsFor(st);
      const keep = new Set(entries.map((e) => e[0]));
      for (const [key, chip] of chips) if (!keep.has(key)) { chip.remove(); chips.delete(key); }
      for (const [key, text, color] of entries) {
        let chip = chips.get(key);
        if (!chip) {
          chip = htmlEl('span', 'chip');
          if (color) chip.style.background = color;
          chips.set(key, chip);
        }
        varsEl.appendChild(chip);
        if (chip.textContent !== text) {
          chip.textContent = text;
          if (animate) retrigger(chip, 'pop');
        }
      }
    }

    let sc = null, cur = -1, prevState = null, timer = null, dots = [];

    function go(k) {
      const steps = sc.steps;
      k = Math.max(0, Math.min(steps.length - 1, k));
      const step = steps[k];
      const st = sc.snaps[k];
      for (const { id, view } of views) view.render(st.scenes[id], prevState && prevState.scenes[id]);

      const cap = $('#caption');
      cap.textContent = step.say || '';
      retrigger(cap, 'rise');

      if (step.line == null) bar.style.opacity = '0';
      else { bar.style.opacity = '1'; bar.style.transform = `translateY(${step.line * 28}px)`; }

      renderVars(st, !!prevState);
      dots.forEach((d, i) => { d.classList.toggle('on', i === k); d.classList.toggle('seen', i < k); });
      $('#counter').textContent = `step ${k + 1} / ${steps.length}  ·  ← → space`;
      $('#prev').disabled = k === 0;
      $('#next').disabled = k === steps.length - 1;

      prevState = st;
      cur = k;
    }

    // scenario picker (only when there's more than one)
    const pickers = [];
    if (scenarios.length > 1) {
      htmlEl('span', 'scen-label', $('#scenarios')).textContent = 'Scenario:';
      scenarios.forEach((s, i) => {
        const b = htmlEl('button', 'btn small', $('#scenarios'));
        b.textContent = s.name || `#${i + 1}`;
        b.addEventListener('click', () => { stop(); select(i); });
        pickers.push(b);
      });
    }
    function select(i, startStep = 0) {
      sc = scenarios[Math.max(0, Math.min(scenarios.length - 1, i))];
      pickers.forEach((b, j) => b.classList.toggle('active', scenarios[j] === sc));
      $('#dots').replaceChildren();
      dots = sc.steps.map((_, j) => {
        const d = htmlEl('button', 'dot', $('#dots'));
        d.title = `Step ${j + 1}`;
        d.addEventListener('click', () => { stop(); go(j); });
        return d;
      });
      prevState = null; // first frame of a scenario renders without animation
      go(startStep);
    }

    const playBtn = $('#play');
    function stop() {
      clearInterval(timer);
      timer = null;
      playBtn.textContent = '▶ Play';
    }
    function play() {
      if (cur >= sc.steps.length - 1) go(0);
      playBtn.textContent = '⏸ Pause';
      timer = setInterval(() => (cur >= sc.steps.length - 1 ? stop() : go(cur + 1)), spec.speed || 2200);
    }
    const toggle = () => (timer ? stop() : play());

    $('#prev').addEventListener('click', () => { stop(); go(cur - 1); });
    $('#next').addEventListener('click', () => { stop(); go(cur + 1); });
    playBtn.addEventListener('click', toggle);
    // space = play/pause, even when a button has focus (stop it also "clicking" that button)
    document.addEventListener('keyup', (e) => { if (e.key === ' ') e.preventDefault(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { stop(); go(cur + 1); }
      else if (e.key === 'ArrowLeft') { stop(); go(cur - 1); }
      else if (e.key === 'Home') { stop(); go(0); }
      else if (e.key === 'End') { stop(); go(sc.steps.length - 1); }
      else if (e.key === ' ') { e.preventDefault(); toggle(); }
    });

    const num = (key) => {
      const v = parseInt(params.get(key), 10);
      return Number.isFinite(v) ? v - 1 : 0;
    };
    select(num('scenario'), num('step'));
  }

  function fail(err) {
    const box = htmlEl('div', 'panel sticker error');
    box.textContent = String(err && err.message ? err.message : err);
    $('#stage').replaceChildren(box);
    $('#title').textContent = 'Could not show this visualisation';
    console.error(err);
  }

  // ---------- load spec ----------
  const params = new URLSearchParams(location.search);
  const name = params.get('spec') || 'binary-search';
  if (!/^[\w-]+$/.test(name)) { fail(`Bad spec name: ${name}`); return; }
  const script = document.createElement('script');
  script.src = `../specs/${name}.js`;
  script.onload = () => { try { init(window.VIZ, params); } catch (e) { fail(e); } };
  script.onerror = () => fail(`Could not load specs/${name}.js`);
  document.head.appendChild(script);
})();
