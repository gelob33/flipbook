// Scene type: flow — swimlanes, step boxes, decision diamonds, and a token that travels
// along the arrows. Columns are worked out from the edges (longest path from the start);
// lanes are rows.
//
// scene: { type: "flow", lanes?: [...], token?: "label",
//          nodes: { id: { lane, label, shape?: "decision", tone?: "good"|"warn"|"bad", col?, opens? } },
//          edges: [[from, to, label?], ...] }
// ops:   { token: "<scene>", at: "<node>" | null }   — moving along an edge marks it taken
//
// Leave out `lanes` (and each node's `lane`) when rows mean nothing, e.g. a state machine or a
// plain flow chart: rows are then picked so boxes never overlap and a chain stays in one row.
//
// opens: "<spec>" makes the node a door to a lower-level diagram (e.g. the work behind a
// state). It gets a ⊕ badge; clicking it (or Enter) opens that spec in the same tab, with a
// breadcrumb back to this step. `vsm check` fails if the spec doesn't exist.
(() => {
  'use strict';
  const { register, svgEl, place, retrigger, addWobble, sticker, wrap, textLines, reduceMotion, lerp, easeInOut } = VSM;

  const LW = 118, COLW = 196, ROWH = 116, PAD = 8;
  const BOX = { w: 142, h: 64 }, DIAMOND = { w: 152, h: 92 };
  const TRAVEL = 900; // ms for the token to cross one edge

  // Columns, in two passes:
  // 1. cycle breaking: walk depth-first from the start nodes (no incoming edges, in spec order);
  //    an edge back to a node still on the walk's path closes a loop (e.g. retry → Paying, or a
  //    self-loop), so it is set aside and never pushes columns;
  // 2. column = longest path over the remaining edges, unless pinned with `col`.
  // Nodes that would share a lane+column are nudged right.
  function layout(lanes, nodes, edges) {
    const ids = Object.keys(nodes);
    const out = Object.fromEntries(ids.map((n) => [n, []]));
    for (const e of edges) out[e.from].push(e.to);
    const back = new Set(), seen = {};
    const walk = (n) => {
      seen[n] = 'open';
      for (const m of out[n]) {
        if (seen[m] === 'open') back.add(`${n}->${m}`);
        else if (!seen[m]) walk(m);
      }
      seen[n] = 'done';
    };
    const hasIn = new Set(edges.filter((e) => e.from !== e.to).map((e) => e.to));
    for (const n of ids) if (!hasIn.has(n) && !seen[n]) walk(n);
    for (const n of ids) if (!seen[n]) walk(n); // nodes only reachable from inside a loop

    const incoming = Object.fromEntries(ids.map((n) => [n, []]));
    for (const e of edges) if (!back.has(e.key)) incoming[e.to].push(e.from);
    const rank = {};
    const rankOf = (n) => (n in rank ? rank[n]
      : (rank[n] = nodes[n].col ?? Math.max(0, ...incoming[n].map((m) => rankOf(m) + 1))));
    const geo = {};
    const used = new Set();
    const lw = lanes.length ? LW : 16; // no lanes: no lane labels, so no label column
    for (const n of [...ids].sort((a, b) => rankOf(a) - rankOf(b))) {
      let lane, col = rankOf(n);
      if (lanes.length) { // named lanes: the lane is fixed, a clash moves the node right
        lane = lanes.indexOf(nodes[n].lane);
        while (used.has(`${lane}:${col}`)) col++;
      } else { // no lanes: the column is fixed, a clash moves the node down a row. Try the row of
        // the node it comes from first, so a chain of steps stays on one straight line.
        const from = incoming[n].map((m) => geo[m]).find(Boolean);
        lane = from && !used.has(`${from.lane}:${col}`) ? from.lane : 0;
        while (used.has(`${lane}:${col}`)) lane++;
      }
      used.add(`${lane}:${col}`);
      const diamond = nodes[n].shape === 'decision';
      const size = diamond ? DIAMOND : BOX;
      geo[n] = { lane, col, diamond, ...size, x: lw + col * COLW + COLW / 2, y: PAD + lane * ROWH + ROWH / 2 };
    }
    return geo;
  }

  const anchor = (g, side) => ({
    r: [g.x + g.w / 2, g.y], l: [g.x - g.w / 2, g.y], t: [g.x, g.y - g.h / 2], b: [g.x, g.y + g.h / 2],
  })[side];

  // between(lane, a, b): is there a box in this lane strictly between columns a and b?
  function edgePath(S, T, between) {
    if (S === T) { // self-loop: a small loop over the top-left of the box
      const sx = S.diamond ? S.x - 22 : S.x - S.w / 2 + 24, sy = S.diamond ? S.y - S.h / 2 + 16 : S.y - S.h / 2;
      return `M ${sx} ${sy} C ${sx - 16} ${sy - 44} ${sx + 46} ${sy - 44} ${sx + 32} ${sy}`;
    }
    if (T.col > S.col && S.diamond && S.lane !== T.lane) {
      // decision branch: leave from the diamond's top/bottom point, bend into the target
      const [sx, sy] = anchor(S, T.lane < S.lane ? 't' : 'b'), [tx, ty] = anchor(T, 'l');
      return `M ${sx} ${sy} C ${sx} ${ty} ${sx} ${ty} ${tx} ${ty}`;
    }
    if (T.col > S.col) {
      const [sx, sy] = anchor(S, 'r'), [tx, ty] = anchor(T, 'l');
      if (S.lane === T.lane && between(S.lane, S.col, T.col)) { // would cross a box: go underneath
        const [bx, by] = anchor(S, 'b'), [ex, ey] = anchor(T, 'b');
        return `M ${bx} ${by} C ${bx} ${by + 46} ${ex} ${ey + 46} ${ex} ${ey}`;
      }
      if (S.lane === T.lane) return `M ${sx} ${sy} L ${tx} ${ty}`;
      const dx = (tx - sx) * 0.6;
      return `M ${sx} ${sy} C ${sx + dx} ${sy} ${tx - dx} ${ty} ${tx} ${ty}`;
    }
    if (S.lane === T.lane) { // backwards in the same lane: loop underneath
      const [sx, sy] = anchor(S, 'b'), [tx, ty] = anchor(T, 'b');
      return `M ${sx} ${sy} C ${sx} ${sy + 46} ${tx} ${ty + 46} ${tx} ${ty}`;
    }
    const down = T.lane > S.lane;
    const [sx, sy] = anchor(S, down ? 'b' : 't'), [tx, ty] = anchor(T, down ? 't' : 'b');
    const dy = (ty - sy) * 0.5;
    return `M ${sx} ${sy} C ${sx} ${sy + dy} ${tx} ${ty - dy} ${tx} ${ty}`;
  }

  function FlowView(id, def, mount, ctx) {
    const lanes = def.lanes || [];
    const nodes = def.nodes || {};
    const ids = Object.keys(nodes);
    for (const n of ids) {
      if (lanes.length && !lanes.includes(nodes[n].lane)) throw new Error(`Flow "${id}": node "${n}" is in unknown lane "${nodes[n].lane}"`);
    }
    const edges = (def.edges || []).map(([from, to, label]) => {
      if (!nodes[from] || !nodes[to]) throw new Error(`Flow "${id}": edge ${from} → ${to} uses an unknown node`);
      return { from, to, label, key: `${from}->${to}` };
    });

    const geo = layout(lanes, nodes, edges);
    const between = (lane, a, b) => Object.values(geo).some((g) => g.lane === lane && g.col > a && g.col < b);
    const cols = Math.max(1, ...Object.values(geo).map((g) => g.col + 1));
    const rows = lanes.length || Math.max(1, ...Object.values(geo).map((g) => g.lane + 1));
    const W = (lanes.length ? LW : 16) + cols * COLW + 8;
    const H = PAD * 2 + rows * ROWH;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': def.title || id }, mount);
    const wobble = addWobble(svg, `wobble-${id}`);

    lanes.forEach((name, i) => {
      const y = PAD + i * ROWH;
      svgEl('rect', { class: `lane${i % 2 ? ' odd' : ''}`, x: 2, y: y + 3, width: W - 4, height: ROWH - 6, rx: 16 }, svg);
      textLines(svgEl('text', { class: 'lane-label' }, svg), wrap(name, 11), 16, y + ROWH / 2, 18);
    });

    // layers, bottom to top
    const edgeLayer = svgEl('g', {}, svg);
    const nodeLayer = svgEl('g', {}, svg);
    const labelLayer = svgEl('g', {}, svg);
    const tokenLayer = svgEl('g', {}, svg);

    // where the token rests on each node (top-right corner)
    const tokLabel = def.token || 'token';
    const tw = tokLabel.length * 7.6 + 24;
    const rest = (n) => {
      const G = geo[n];
      return G.diamond ? { x: G.x + G.w * 0.32, y: G.y - G.h * 0.42 } : { x: G.x + G.w / 2 - 16, y: G.y - G.h / 2 - 2 };
    };

    // edge labels keep clear of boxes, the token's resting spots and each other
    const rect = (x, y, w, h) => ({ x1: x - w / 2, y1: y - h / 2, x2: x + w / 2, y2: y + h / 2 });
    const overlap = (a, b) => Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1))
      * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
    const blocked = [
      ...ids.map((n) => rect(geo[n].x, geo[n].y, geo[n].w + 6, geo[n].h + 6)),
      ...ids.map((n) => { const r = rest(n); return rect(r.x, r.y, tw + 4, 28); }),
    ];
    // try spots along the edge (middle first) and just above/below it; the first spot that
    // covers least wins. Neighbours in one lane also get a spot under the boxes.
    function labelSpot(base, len, lw, S, T) {
      const straight = S.lane === T.lane && S !== T;
      const spots = [];
      for (const t of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        const pt = base.getPointAtLength(len * t);
        for (const dy of straight ? [-18, 18, 0] : [0, -18, 18]) spots.push({ x: pt.x, y: pt.y + dy });
      }
      if (straight) spots.push({ x: (S.x + T.x) / 2, y: S.y + S.h / 2 + 16 });
      let best = spots[0], least = Infinity;
      for (const s of spots) {
        const r = rect(s.x, s.y, lw, 22);
        const cost = blocked.reduce((c, b) => c + overlap(r, b), 0);
        if (cost < least - 0.5) { best = s; least = cost; }
      }
      blocked.push(rect(best.x, best.y, lw, 22));
      return best;
    }

    // --- edges: dashed base, an ink overlay that "draws" when taken, an arrowhead, a label
    const E = {};
    for (const e of edges) {
      const g = svgEl('g', { class: 'edge' }, edgeLayer);
      const d = edgePath(geo[e.from], geo[e.to], between);
      const base = svgEl('path', { class: 'edge-base', d }, g);
      const ink = svgEl('path', { class: 'edge-ink', d }, g);
      const len = base.getTotalLength();
      ink.style.strokeDasharray = `${len} ${len}`;
      ink.style.strokeDashoffset = len;
      const end = base.getPointAtLength(len), pre = base.getPointAtLength(Math.max(0, len - 6));
      const ang = (Math.atan2(end.y - pre.y, end.x - pre.x) * 180) / Math.PI;
      const head = svgEl('path', {
        class: 'edge-head', d: 'M 1 0 L -11 -6.5 L -11 6.5 Z', transform: `translate(${end.x} ${end.y}) rotate(${ang})`,
      }, g);
      let label = null;
      if (e.label) {
        const lw = e.label.length * 7 + 18;
        const at = labelSpot(base, len, lw, geo[e.from], geo[e.to]);
        label = svgEl('g', { class: 'edge-label', transform: `translate(${at.x} ${at.y})` }, labelLayer);
        svgEl('rect', { x: -lw / 2, y: -11, width: lw, height: 22, rx: 11 }, label);
        svgEl('text', { x: 0, y: 0 }, label).textContent = e.label;
      }
      E[e.key] = { ...e, g, base, ink, head, len, label };
    }

    // --- nodes
    const N = {};
    for (const n of ids) {
      const G = geo[n];
      const g = svgEl('g', { class: G.diamond ? 'node decision' : 'node' }, nodeLayer);
      g.style.transform = `translate(${G.x}px, ${G.y}px)`;
      if (nodes[n].tone) g.dataset.tone = nodes[n].tone;
      const inner = svgEl('g', { class: 'inner' }, g);
      const shape = svgEl('g', { filter: wobble }, inner);
      if (G.diamond) {
        sticker(shape, 'polygon', { points: `0,${-G.h / 2} ${G.w / 2},0 0,${G.h / 2} ${-G.w / 2},0` });
      } else {
        sticker(shape, 'rect', { x: -G.w / 2, y: -G.h / 2, width: G.w, height: G.h, rx: 14 });
      }
      textLines(svgEl('text', { class: 'node-label' }, inner), wrap(nodes[n].label || n, G.diamond ? 11 : 14), 0, 0, 18);
      if (nodes[n].opens) {
        const child = nodes[n].opens;
        const bx = G.diamond ? 0 : G.w / 2 - 6, by = G.h / 2 - 2;
        const badge = svgEl('g', { class: 'opens-badge', transform: `translate(${bx} ${by})` }, inner);
        sticker(badge, 'circle', { cx: 0, cy: 0, r: 11 }, { offset: 2, cls: 'badge-body' });
        svgEl('path', { class: 'badge-plus', d: 'M -5 0 H 5 M 0 -5 V 5' }, badge);
        g.classList.add('opens');
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'link');
        g.setAttribute('aria-label', `Open the detail of ${nodes[n].label || n}: ${child}`);
        svgEl('title', {}, g).textContent = `Open level below: ${child}`;
        const go = () => ctx.open(child);
        g.addEventListener('click', go);
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      }
      N[n] = { g, inner };
    }

    // --- token: rests on the top-right of its node, travels along edges
    const tokG = svgEl('g', { class: 'token gone' }, tokenLayer);
    const tokInner = svgEl('g', { class: 'inner' }, tokG);
    sticker(tokInner, 'rect', { x: -tw / 2, y: -12, width: tw, height: 24, rx: 12 }, { offset: 3, cls: 'token-body' });
    svgEl('text', { x: 0, y: 0 }, tokInner).textContent = tokLabel;

    let raf = 0;
    function travel(path, len, from, to, done) {
      const p0 = path.getPointAtLength(0), p1 = path.getPointAtLength(len);
      const t0 = performance.now();
      tokG.style.transition = 'none';
      const frame = (now) => {
        const t = Math.min(1, (now - t0) / TRAVEL), u = easeInOut(t);
        let x, y;
        if (u < 0.12) { x = lerp(from.x, p0.x, u / 0.12); y = lerp(from.y, p0.y, u / 0.12); }
        else if (u > 0.88) { x = lerp(p1.x, to.x, (u - 0.88) / 0.12); y = lerp(p1.y, to.y, (u - 0.88) / 0.12); }
        else { const pt = path.getPointAtLength((len * (u - 0.12)) / 0.76); x = pt.x; y = pt.y; }
        tokG.style.transform = `translate(${x}px, ${y}px)`;
        if (t < 1) raf = requestAnimationFrame(frame);
        else { tokG.style.transition = ''; done(); }
      };
      raf = requestAnimationFrame(frame);
    }

    function setNode(n, state) {
      if (state) N[n].g.dataset.state = state; else delete N[n].g.dataset.state;
    }
    function arrive(n) {
      setNode(n, 'current');
      retrigger(N[n].inner, 'pop');
      retrigger(tokInner, 'pop');
    }

    function render(s, p) {
      cancelAnimationFrame(raf);
      tokG.style.transition = '';
      // animate only a single step forward along a real edge (self-loops included)
      const hop = p && s.moves === p.moves + 1 ? s.last : null;
      const moving = hop && E[hop] && !reduceMotion;

      for (const n of ids) setNode(n, s.token === n ? 'current' : s.visited.has(n) ? 'visited' : '');
      if (moving) setNode(s.token, p.visited.has(s.token) ? 'visited' : ''); // lights up on arrival

      for (const e of Object.values(E)) {
        const on = s.taken.has(e.key);
        const draw = moving && e.key === hop && !p.taken.has(e.key);
        e.g.classList.toggle('taken', on);
        if (e.label) e.label.classList.toggle('taken', on);
        e.ink.style.transition = draw ? `stroke-dashoffset ${TRAVEL}ms ease-in-out` : 'none';
        e.head.style.transitionDelay = draw ? `${TRAVEL - 150}ms` : '0ms';
        e.ink.style.strokeDashoffset = on ? 0 : e.len;
      }

      if (!s.token) { tokG.classList.add('gone'); return; }
      const to = rest(s.token);
      const appearing = !p || tokG.classList.contains('gone');
      tokG.classList.remove('gone');
      if (moving) {
        travel(E[hop].base, E[hop].len, rest(p.token), to, () => arrive(s.token));
      } else {
        place(tokG, to.x, to.y, appearing);
        if (p && p.token !== s.token) arrive(s.token);
      }
    }

    return { render };
  }

  register('flow', {
    place: 'stage',
    verbs: ['token'],
    // moves counts token ops and last is the edge the latest one used (or null), so the view
    // can animate a self-loop, where the token ends where it started
    state: () => ({ token: null, visited: new Set(), taken: new Set(), moves: 0, last: null }),
    apply(s, verb, op, def) {
      s.moves++;
      s.last = null;
      if (op.at == null) { s.token = null; return; }
      if (!def.nodes[op.at]) throw new Error(`unknown node "${op.at}"`);
      if (s.token && (def.edges || []).some(([a, b]) => a === s.token && b === op.at)) {
        s.last = `${s.token}->${op.at}`;
        s.taken.add(s.last);
      }
      s.visited.add(op.at);
      s.token = op.at;
    },
    View: FlowView,
  });
})();
