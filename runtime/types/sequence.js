// Scene type: sequence — who sends what to whom, in time order. People or systems are columns
// with lifelines running down; each message is an arrow across, added under the last one.
// The newest arrow draws itself from sender to receiver; sender and receiver light up.
//
// scene: { type: "sequence", actors: { id: "Label", ... } }   — columns, left to right
// ops:   { send: "<scene>", from, to, label, reply?: true }
//          reply: true  draws a dashed arrow (an answer to an earlier message)
//          from === to  draws a self-message: a small loop (e.g. the bank checks the card)
(() => {
  'use strict';
  const { register, svgEl, retrigger, addWobble, sticker, wrap, textLines, reduceMotion, easeInOut } = VSM;

  const COLW = 230, AW = 172, AH = 54, TOP = 10, FIRST = TOP + AH + 26, ROW = 60, TRAVEL = 800;

  function SequenceView(id, def, mount, ctx) {
    const actors = Object.keys(def.actors || {});
    if (!actors.length) throw new Error(`Sequence "${id}" needs "actors"`);
    const ax = (a) => COLW / 2 + actors.indexOf(a) * COLW;
    const rows = Math.max(1, ...ctx.snaps.map((s) => s.msgs.length)); // fixed height: no jumps
    const W = actors.length * COLW, H = FIRST + rows * ROW + 8;
    const rowY = (i) => FIRST + i * ROW + ROW / 2;

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': def.title || id }, mount);
    const wobble = addWobble(svg, `wobble-${id}`);
    const lifeLayer = svgEl('g', {}, svg);
    const msgLayer = svgEl('g', {}, svg);
    const actorLayer = svgEl('g', {}, svg);

    const A = {};
    for (const a of actors) {
      svgEl('line', { class: 'lifeline', x1: ax(a), y1: TOP + AH, x2: ax(a), y2: H - 4 }, lifeLayer);
      const g = svgEl('g', { class: 'actor' }, actorLayer);
      g.style.transform = `translate(${ax(a)}px, ${TOP + AH / 2}px)`;
      const inner = svgEl('g', { class: 'inner' }, g);
      sticker(svgEl('g', { filter: wobble }, inner), 'rect', { x: -AW / 2, y: -AH / 2, width: AW, height: AH, rx: 14 });
      textLines(svgEl('text', { class: 'node-label' }, inner), wrap(def.actors[a], 16), 0, 0, 18);
      A[a] = { g, inner };
    }

    // one message: line + head + numbered label, inside a clip rect that grows from the sender
    function build(i, m, key) {
      const y = rowY(i), x1 = ax(m.from), x2 = ax(m.to);
      const self = m.from === m.to;
      const dir = self ? (actors.indexOf(m.from) < actors.length / 2 ? 1 : -1) : x2 > x1 ? 1 : -1;
      const g = svgEl('g', { class: `msg${m.reply ? ' reply' : ''}` }, msgLayer);
      const clipId = `${id}-msg-${i}`;
      const clip = svgEl('rect', { x: 0, y: y - 30, width: 0, height: 60 }, svgEl('clipPath', { id: clipId }, g));
      const body = svgEl('g', { 'clip-path': `url(#${clipId})` }, g);

      const text = `${i + 1}. ${m.label}`;
      const lw = text.length * 7.6 + 20;
      let d, head, lx, ly, anchor;
      if (self) {
        // loop and label go to the side with more room (right, unless this is the right half)
        const s = actors.indexOf(m.from) < actors.length / 2 ? 1 : -1;
        d = `M ${x1} ${y - 12} H ${x1 + s * 44} V ${y + 12} H ${x1 + s * 6}`;
        head = { x: x1 + s * 4, y: y + 12, ang: s > 0 ? 180 : 0 };
        lx = x1 + s * 56; ly = y; anchor = s > 0 ? 'start' : 'end';
      } else {
        const end = x2 - dir * 4;
        d = `M ${x1} ${y} H ${end}`;
        head = { x: end, y, ang: dir > 0 ? 0 : 180 };
        lx = (x1 + x2) / 2; ly = y - 15; anchor = 'middle';
      }
      svgEl('path', { class: 'msg-line', d }, body);
      svgEl('path', { class: 'msg-head', d: 'M 1 0 L -11 -6.5 L -11 6.5 Z', transform: `translate(${head.x} ${head.y}) rotate(${head.ang})` }, body);
      const label = svgEl('g', { class: 'msg-label', transform: `translate(${lx} ${ly})` }, body);
      const rx = { start: 0, middle: -lw / 2, end: -lw }[anchor];
      svgEl('rect', { x: rx, y: -11, width: lw, height: 22, rx: 11 }, label);
      svgEl('text', { x: rx + lw / 2, y: 0, 'text-anchor': 'middle' }, label).textContent = text;

      const box = body.getBBox();
      return { g, clip, key, to: m.to, dir, lo: box.x - 4, hi: box.x + box.width + 4 };
    }
    function reveal(el, u) {
      const w = (el.hi - el.lo) * u;
      el.clip.setAttribute('x', el.dir > 0 ? el.lo : el.hi - w);
      el.clip.setAttribute('width', w);
    }

    const els = [];
    let raf = 0;
    function render(s, p) {
      cancelAnimationFrame(raf);
      while (els.length > s.msgs.length) els.pop().g.remove();
      s.msgs.forEach((m, i) => {
        const key = JSON.stringify(m);
        if (els[i] && els[i].key !== key) { els[i].g.remove(); els[i] = null; } // other scenario
        if (!els[i]) els[i] = build(i, m, key);
        els[i].g.classList.toggle('old', i < s.msgs.length - 1);
        reveal(els[i], 1);
      });

      const last = s.msgs[s.msgs.length - 1];
      for (const a of actors) delete A[a].g.dataset.role;
      if (!last) return;
      A[last.from].g.dataset.role = 'from';
      if (last.to !== last.from) A[last.to].g.dataset.role = 'to';

      // a single step forward that added one message: draw it, then pop the receiver
      if (p && s.msgs.length === p.msgs.length + 1 && !reduceMotion) {
        const el = els[els.length - 1];
        const t0 = performance.now();
        reveal(el, 0);
        const frame = (now) => {
          const t = Math.min(1, (now - t0) / TRAVEL);
          reveal(el, easeInOut(t));
          if (t < 1) raf = requestAnimationFrame(frame);
          else retrigger(A[el.to].inner, 'pop');
        };
        raf = requestAnimationFrame(frame);
      }
    }

    return { render };
  }

  register('sequence', {
    place: 'stage',
    verbs: ['send'],
    state: () => ({ msgs: [] }),
    apply(s, verb, op, def) {
      for (const k of ['from', 'to']) {
        if (!def.actors || !def.actors[op[k]]) {
          throw new Error(`unknown actor "${op[k]}" in "${k}" (have: ${Object.keys(def.actors || {}).join(', ')})`);
        }
      }
      if (!op.label) throw new Error('a message needs a "label"');
      s.msgs.push({ from: op.from, to: op.to, label: op.label, reply: !!op.reply });
    },
    View: SequenceView,
  });
})();
