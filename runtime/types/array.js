// Scene type: array — cells with values, marks, dimmed ranges and named pointers.
//
// scene: { type: "array", values: [...], pointers?: { name: { side: "above" | "below" } } }
// ops:   { pointer: "lo", on: "<scene>", at: 3 | null }
//        { mark: "<scene>", at | range, as: "compare" | "found" | "visited" | "sorted" }
//        { unmark | dim | undim: "<scene>", at | range }
//        { set: "<scene>", at, value }
(() => {
  'use strict';
  const { register, svgEl, place, retrigger, addWobble, sticker } = VSM;

  const CW = 64, GAP = 14, X0 = 24, STACK = 38;

  function indices(op) {
    if (!op.range) return [op.at];
    const out = [];
    for (let i = op.range[0]; i <= op.range[1]; i++) out.push(i);
    return out;
  }

  function ArrayView(id, def, mount, ctx) {
    const n = def.values.length;
    const sideOf = (name) => (def.pointers && def.pointers[name] && def.pointers[name].side) || 'below';

    // pointer order (first appearance) and how many ever stack on one cell, per side
    const order = [];
    const levels = { above: 0, below: 0 };
    for (const s of ctx.snaps) {
      const count = {};
      for (const [name, at] of Object.entries(s.pointers)) {
        if (!order.includes(name)) order.push(name);
        const key = `${sideOf(name)}:${at}`;
        count[key] = (count[key] || 0) + 1;
        levels[sideOf(name)] = Math.max(levels[sideOf(name)], count[key]);
      }
    }
    order.forEach((name) => ctx.colorOf(name));

    const W = X0 * 2 + n * CW + (n - 1) * GAP;
    const TOP = 24 + levels.above * STACK;
    const H = TOP + CW + 26 + levels.below * STACK;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': def.title || id }, mount);
    const wobble = addWobble(svg, `wobble-${id}`);

    const cellX = (i) => X0 + i * (CW + GAP);
    const cells = [];
    for (let i = 0; i < n; i++) {
      const g = svgEl('g', { class: 'cell' }, svg);
      place(g, cellX(i), TOP, true);
      const inner = svgEl('g', { class: 'inner' }, g);
      const tilt = svgEl('g', { transform: `rotate(${(((i * 37) % 5) - 2) * 0.6} ${CW / 2} ${CW / 2})` }, inner);
      sticker(svgEl('g', { filter: wobble }, tilt), 'rect', { x: 0, y: 0, width: CW, height: CW, rx: 12 });
      const val = svgEl('text', { class: 'val', x: CW / 2, y: CW / 2 }, tilt);
      svgEl('text', { class: 'idx', x: CW - 7, y: CW - 7 }, tilt).textContent = i;
      cells.push({ g, inner, val });
    }

    const ptrLayer = svgEl('g', {}, svg);
    const ptrs = {};
    function makePtr(name) {
      const side = sideOf(name);
      const s = side === 'above' ? -1 : 1;
      const g = svgEl('g', { class: 'ptr' }, ptrLayer);
      const inner = svgEl('g', { class: 'inner' }, g);
      const tw = Math.max(46, name.length * 10 + 26), th = 28;
      const ty = s === 1 ? 10 : -10 - th;
      const tag = sticker(inner, 'rect', { x: -tw / 2, y: ty, width: tw, height: th, rx: 10 }, { offset: 3, cls: 'tag' });
      const tri = svgEl('path', { class: 'tag', d: `M -8 ${10 * s} L 0 0 L 8 ${10 * s} Z` }, inner);
      tri.style.fill = tag.style.fill = ctx.colorOf(name);
      svgEl('text', { x: 0, y: ty + th / 2 }, inner).textContent = name;
      return { g, inner, side, at: undefined };
    }

    function render(s, p) {
      for (let i = 0; i < n; i++) {
        const c = cells[i];
        c.val.textContent = s.values[i];
        const dim = s.dim.has(i);
        c.g.classList.toggle('dim', dim);
        place(c.g, cellX(i), TOP + (dim ? 10 : 0), !p);
        const mark = s.marks[i] || '';
        if (mark) c.g.dataset.mark = mark; else delete c.g.dataset.mark;
        const changed = p && ((mark && mark !== (p.marks[i] || '')) || p.values[i] !== s.values[i]);
        if (changed) retrigger(c.inner, 'pop');
      }

      const level = { above: {}, below: {} };
      for (const name of order) {
        const at = s.pointers[name];
        let ptr = ptrs[name];
        if (at == null) { if (ptr) ptr.g.classList.add('gone'); continue; }
        const fresh = !ptr;
        if (fresh) ptr = ptrs[name] = makePtr(name);
        const lvl = level[ptr.side][at] = (level[ptr.side][at] ?? -1) + 1;
        const x = cellX(at) + CW / 2;
        const y = ptr.side === 'above' ? TOP - 8 - lvl * STACK : TOP + CW + 8 + lvl * STACK;
        const appearing = fresh || ptr.g.classList.contains('gone');
        ptr.g.classList.remove('gone');
        place(ptr.g, x, y, appearing || !p);
        if (appearing) retrigger(ptr.inner, 'pop');
        else if (p && ptr.at !== at) retrigger(ptr.inner, 'hop');
        ptr.at = at;
      }
    }

    const chips = (s) => order
      .filter((name) => s.pointers[name] != null)
      .map((name) => [`${id}.${name}`, `${name} = ${s.pointers[name]}`, ctx.colorOf(name)]);

    return { render, chips };
  }

  register('array', {
    place: 'stage',
    verbs: ['pointer', 'mark', 'unmark', 'dim', 'undim', 'set'],
    target: (verb, op) => (verb === 'pointer' ? op.on : op[verb]),
    state: (def) => ({ values: [...def.values], marks: {}, dim: new Set(), pointers: {} }),
    apply(s, verb, op) {
      if (verb === 'pointer') { if (op.at == null) delete s.pointers[op.pointer]; else s.pointers[op.pointer] = op.at; }
      else if (verb === 'mark') for (const i of indices(op)) s.marks[i] = op.as;
      else if (verb === 'unmark') for (const i of indices(op)) delete s.marks[i];
      else if (verb === 'dim') for (const i of indices(op)) s.dim.add(i);
      else if (verb === 'undim') for (const i of indices(op)) s.dim.delete(i);
      else if (verb === 'set') s.values[op.at] = op.value;
    },
    View: ArrayView,
  });
})();
