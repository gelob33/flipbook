// Scene type: mindmap — one central idea, branches spreading left and right, cross-links that
// tie ideas on different branches together. The map grows branch by branch as you step.
//
// scene: { type: "mindmap",
//          outline: `
//            - Central idea
//              - Branch
//                - Leaf`,
//          notes?: { "<label>": "text shown when the idea is clicked" },
//          collapsed?: ["<label>", ...] }          — branches that start folded
//   Outline: one idea per line, nested by indentation ("- " or "* " bullets optional), or
//   PlantUML style with no indentation ("* root", "** branch", "*** leaf"). The first line is
//   the centre. Labels must be unique: ops, notes and collapsed refer to ideas by label.
// ops:   { grow: "<scene>", at: "<label>", deep?: true }   — show an idea (and the path to it);
//                                                          deep: its whole subtree too. Focuses it.
//        { focus: "<scene>", at: "<label>" | null }       — highlight an idea and its path
//        { link: "<scene>", from, to, label? }            — a dashed cross-link between ideas
//
// The viewer can also, without changing the step:
//   - fold / unfold a branch with the −/+N button on its outer edge (the map re-packs);
//   - click an idea to read its note (ⓘ marks ideas that have one);
//   - zoom (− Fit +) and scroll. The view scrolls to the focused idea, and a step that focuses
//     an idea inside a folded branch unfolds it.
(() => {
  'use strict';
  const { register, svgEl, htmlEl, retrigger, addWobble, sticker, wrap, textLines, instantly } = VSM;

  const HGAP = 56, VGAP = 12, PAD = 24, MIN_ZOOM = 0.3, MAX_ZOOM = 2, READABLE = 0.75;
  const BRANCH = ['var(--sky)', 'var(--pink)', 'var(--mint)', 'var(--peach)', 'var(--lav)', 'var(--rose)'];

  // ---------- outline → tree, sizes, sides and colours (cached per scene definition) ----------
  const trees = new WeakMap();
  function treeOf(def) {
    if (trees.has(def)) return trees.get(def);
    const lines = String(def.outline || '').split('\n').filter((l) => l.trim());
    if (!lines.length) throw new Error('mindmap needs an "outline"');
    const stars = lines.some((l) => /^\s*\*\*/.test(l)); // PlantUML style: depth = number of stars
    const byLabel = new Map();
    const stack = [];
    let root = null;
    for (const line of lines) {
      const m = line.replace(/\t/g, '    ').match(/^(\s*)([-*+]+)?\s*(.*?)\s*$/);
      const label = m[3];
      const indent = stars ? (m[2] || '').length : m[1].length;
      if (byLabel.has(label)) throw new Error(`mindmap: "${label}" appears twice (labels must be unique)`);
      const node = { label, children: [], indent };
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      const parent = stack[stack.length - 1];
      if (!root) root = node;
      else if (!parent) throw new Error(`mindmap: "${label}" is not inside the first line's idea`);
      else { node.parent = parent; parent.children.push(node); }
      stack.push(node);
      byLabel.set(label, node);
    }
    for (const [label, text] of Object.entries(def.notes || {})) need({ byLabel }, label).note = String(text);
    for (const label of def.collapsed || []) need({ byLabel }, label);

    measure(root, 0);
    // sides: balance the full tree's height left/right once, so folding never flips a branch
    const full = new Map();
    const span = (n) => full.get(n) ?? full.set(n, Math.max(n.h, n.children.reduce((t, c) => t + span(c), 0) + VGAP * Math.max(0, n.children.length - 1))).get(n);
    const total = root.children.reduce((t, c) => t + span(c), 0);
    let run = 0;
    root.children.forEach((c, i) => {
      const side = run < total / 2 ? 1 : -1;
      run += span(c);
      const color = BRANCH[i % BRANCH.length];
      (function paint(n) { n.color = color; n.side = side; n.children.forEach(paint); })(c);
    });
    const tree = { root, byLabel, all: [...byLabel.values()] };
    trees.set(def, tree);
    return tree;
  }
  function need(tree, label) {
    const n = tree.byLabel.get(label);
    if (!n) throw new Error(`mindmap has no idea "${label}"`);
    return n;
  }
  const pathTo = (n) => { const out = []; for (let x = n; x; x = x.parent) out.push(x.label); return out; };
  const count = (n) => n.children.reduce((t, c) => t + 1 + count(c), 0);

  function measure(n, depth) {
    const lines = wrap(n.label, depth === 0 ? 14 : 20);
    const ch = depth === 0 ? 10 : depth === 1 ? 8.6 : 8.2;
    n.depth = depth;
    n.lines = lines;
    n.w = Math.max(...lines.map((l) => l.length)) * ch + (depth === 0 ? 40 : 28);
    n.h = lines.length * 18 + (depth === 0 ? 30 : 18);
    n.children.forEach((c) => measure(c, depth + 1));
  }

  // ---------- layout of what's unfolded: centre at 0,0 ----------
  // Folded ideas sit on their nearest unfolded ancestor, so they slide out of / into it.
  function layout(tree, collapsed) {
    const kids = (n) => (collapsed.has(n.label) ? [] : n.children);
    const spans = new Map();
    const span = (n) => spans.get(n) ?? spans.set(n, Math.max(n.h, kids(n).reduce((t, c) => t + span(c), 0) + VGAP * Math.max(0, kids(n).length - 1))).get(n);
    const pos = new Map([[tree.root.label, { x: 0, y: 0 }]]);
    const visible = new Set([tree.root.label]);
    for (const side of [1, -1]) {
      const branches = tree.root.children.filter((c) => c.side === side);
      const widest = [];
      (function scan(n) { for (const c of kids(n)) { widest[c.depth] = Math.max(widest[c.depth] || 0, c.w); scan(c); } })({ label: '', children: branches });
      const start = [0, tree.root.w / 2 + HGAP];
      for (let d = 2; d < widest.length; d++) start[d] = start[d - 1] + widest[d - 1] + HGAP;
      const place = (n, top) => {
        visible.add(n.label);
        const x = side * (start[n.depth] + n.w / 2);
        const ks = kids(n);
        if (!ks.length) { pos.set(n.label, { x, y: top + span(n) / 2 }); return; }
        let t = top + (span(n) - (ks.reduce((s, c) => s + span(c), 0) + VGAP * (ks.length - 1))) / 2;
        for (const c of ks) { place(c, t); t += span(c) + VGAP; }
        pos.set(n.label, { x, y: (pos.get(ks[0].label).y + pos.get(ks[ks.length - 1].label).y) / 2 });
      };
      const height = branches.reduce((t, c) => t + span(c), 0) + VGAP * Math.max(0, branches.length - 1);
      let top = -height / 2;
      for (const c of branches) { place(c, top); top += span(c) + VGAP; }
    }
    for (const n of tree.all) {
      if (pos.has(n.label)) continue;
      let a = n.parent;
      while (!pos.has(a.label)) a = a.parent;
      pos.set(n.label, pos.get(a.label));
    }
    return { pos, visible };
  }

  // a branch from parent p to idea n
  function edgeD(p, n, pos) {
    const P = pos.get(p.label), Q = pos.get(n.label), s = n.side;
    const sx = p.depth === 0 ? P.x + s * (p.w / 2 - 10) : P.x + s * p.w / 2, ex = Q.x - s * n.w / 2;
    return `M ${sx} ${P.y} C ${(sx + ex) / 2} ${P.y} ${(sx + ex) / 2} ${Q.y} ${ex} ${Q.y}`;
  }
  // a cross-link. Ideas on the same side: leave from their outer edges and bow outwards, round
  // the leaves, so the link never hides behind boxes. Otherwise: edge to facing edge.
  function linkGeom(a, b, pos) {
    const A = pos.get(a.label), B = pos.get(b.label);
    const edge = (n, P, s) => ({ x: P.x + s * n.w / 2, y: P.y });
    if (a.side && a.side === b.side) {
      const s = a.side, p = edge(a, A, s), q = edge(b, B, s);
      const out = s > 0 ? Math.max(p.x, q.x) : Math.min(p.x, q.x);
      const cx = out + s * (44 + Math.abs(q.y - p.y) * 0.3);
      return { d: `M ${p.x} ${p.y} C ${cx} ${p.y} ${cx} ${q.y} ${q.x} ${q.y}`, mid: { x: (p.x + q.x) / 4 + cx / 2, y: (p.y + q.y) / 2 }, xs: [p.x, cx] };
    }
    const s = B.x >= A.x ? 1 : -1, p = edge(a, A, s), q = edge(b, B, -s);
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, bow = 0.15;
    const c = { x: mx - (q.y - p.y) * bow, y: my + (q.x - p.x) * bow };
    return { d: `M ${p.x} ${p.y} Q ${c.x} ${c.y} ${q.x} ${q.y}`, mid: { x: (mx + c.x) / 2, y: (my + c.y) / 2 }, xs: [p.x, q.x] };
  }
  const linkKey = (l) => JSON.stringify([l.from, l.to, l.label || '']);

  function MindmapView(id, def, mount, ctx) {
    const tree = treeOf(def);
    const { root, byLabel, all } = tree;
    const collapsed = new Set(def.collapsed || []);
    const allLinks = new Map(); // every link in any step, so the canvas doesn't jump when one appears
    for (const s of ctx.snaps) for (const l of s.links) allLinks.set(linkKey(l), l);

    // ---------- chrome: toolbar, scrolling viewport, note card ----------
    mount.classList.add('mm-panel');
    const bar = htmlEl('div', 'mm-bar', mount);
    const button = (text, title, fn) => {
      const b = htmlEl('button', '', bar);
      b.textContent = text;
      b.title = title;
      b.addEventListener('click', fn);
      return b;
    };
    const viewport = htmlEl('div', 'mm-viewport', mount);
    const card = htmlEl('div', 'mm-note', mount);
    card.hidden = true;

    const svg = svgEl('svg', { role: 'img', 'aria-label': def.title || id }, viewport);
    const wobble = addWobble(svg, `wobble-${id}`);
    const edgeLayer = svgEl('g', {}, svg);
    const linkLayer = svgEl('g', {}, svg);
    const nodeLayer = svgEl('g', {}, svg);

    // ---------- branches ----------
    const E = new Map();
    for (const n of all) {
      if (!n.parent) continue;
      const width = n.depth === 1 ? 7 : n.depth === 2 ? 4.5 : 3;
      const g = svgEl('g', { class: 'mm-edge' }, edgeLayer);
      const under = svgEl('path', { class: 'mm-under', 'stroke-width': width + 4 }, g);
      const over = svgEl('path', { class: 'mm-over', 'stroke-width': width }, g);
      over.style.stroke = n.color;
      E.set(n.label, { g, paths: [under, over] });
    }

    // ---------- ideas ----------
    const N = new Map();
    let selected = null;
    for (const n of all) {
      const g = svgEl('g', { class: `mm-node depth-${Math.min(n.depth, 2)}`, tabindex: '0', role: 'button' }, nodeLayer);
      g.setAttribute('aria-label', `${n.label}${n.note ? ' (has a note)' : ''}`);
      const inner = svgEl('g', { class: 'inner' }, g);
      const body = sticker(svgEl('g', { filter: wobble }, inner), 'rect', { x: -n.w / 2, y: -n.h / 2, width: n.w, height: n.h, rx: n.depth === 0 ? 22 : 14 });
      if (n.depth === 1) body.style.fill = n.color;
      textLines(svgEl('text', { class: 'mm-label' }, inner), n.lines, 0, 0, 18);
      if (n.note) { // ⓘ: this idea has a note
        const s = n.side || 1;
        const info = svgEl('g', { class: 'mm-info', transform: `translate(${-s * (n.w / 2 - 2)} ${-n.h / 2 + 2})` }, inner);
        svgEl('circle', { r: 8 }, info);
        svgEl('text', { x: 0, y: 0.5 }, info).textContent = 'i';
      }
      let toggle = null;
      if (n.children.length && n.depth > 0) { // −/+N: fold or unfold this branch
        toggle = svgEl('g', { class: 'mm-toggle', transform: `translate(${n.side * (n.w / 2 + 4)} 0)` }, g);
        toggle.rect = svgEl('rect', { y: -10, height: 20, rx: 10 }, toggle);
        toggle.text = svgEl('text', { y: 0.5 }, toggle);
        svgEl('title', {}, toggle).textContent = 'Fold / unfold this branch';
        toggle.addEventListener('click', (e) => { e.stopPropagation(); fold(n, !collapsed.has(n.label)); });
      }
      g.addEventListener('click', () => openNote(n));
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); openNote(n); }
        if ((e.key === '-' || e.key === '+') && toggle) { e.preventDefault(); fold(n, e.key === '-'); }
      });
      N.set(n.label, { g, inner, toggle });
    }

    // ---------- cross-links (built when first needed) ----------
    const L = new Map();
    function linkEl(l) {
      const k = linkKey(l);
      if (L.has(k)) return L.get(k);
      const g = svgEl('g', { class: 'mm-link' }, linkLayer);
      const path = svgEl('path', {}, g);
      let tag = null;
      if (l.label) {
        const lw = l.label.length * 7 + 18;
        tag = svgEl('g', { class: 'mm-link-label' }, g);
        svgEl('rect', { x: -lw / 2, y: -11, width: lw, height: 22, rx: 11 }, tag);
        svgEl('text', { x: 0, y: 0 }, tag).textContent = l.label;
      }
      const el = { g, path, tag, l };
      L.set(k, el);
      return el;
    }
    for (const l of allLinks.values()) linkEl(l);

    // ---------- layout, canvas size and zoom ----------
    let lay = null, vb = null, zoom = null, cur = null;
    const setD = (path, d, animate) => {
      const set = () => { path.style.d = `path("${d}")`; };
      if (animate) set(); else instantly(path, set);
    };
    function applyLayout(animate) {
      lay = layout(tree, collapsed);
      const { pos, visible } = lay;
      for (const n of all) {
        const { g, toggle } = N.get(n.label);
        const P = pos.get(n.label);
        const move = () => { g.style.transform = `translate(${P.x}px, ${P.y}px)`; g.classList.toggle('folded', !visible.has(n.label)); };
        if (animate) move(); else instantly(g, move);
        if (toggle) {
          const text = collapsed.has(n.label) ? `+${count(n)}` : '−';
          const w = text.length * 7.5 + 12;
          toggle.text.textContent = text;
          toggle.rect.setAttribute('x', n.side > 0 ? 0 : -w);
          toggle.rect.setAttribute('width', w);
          toggle.text.setAttribute('x', n.side * w / 2);
          toggle.classList.toggle('is-folded', collapsed.has(n.label));
        }
        const e = E.get(n.label);
        if (e) {
          const d = edgeD(n.parent, n, pos);
          for (const p of e.paths) setD(p, d, animate);
          e.g.classList.toggle('folded', !visible.has(n.label));
        }
      }
      // canvas: every unfolded idea, plus every link whose ends are both unfolded
      const xs = [], ys = [];
      for (const label of visible) {
        const n = byLabel.get(label), P = pos.get(label);
        xs.push(P.x - n.w / 2 - 30, P.x + n.w / 2 + 30);
        ys.push(P.y - n.h / 2, P.y + n.h / 2);
      }
      for (const el of L.values()) {
        const a = byLabel.get(el.l.from), b = byLabel.get(el.l.to);
        const ok = visible.has(a.label) && visible.has(b.label);
        el.g.classList.toggle('folded', !ok);
        const geo = linkGeom(a, b, pos);
        setD(el.path, geo.d, animate);
        if (el.tag) {
          const move = () => { el.tag.style.transform = `translate(${geo.mid.x}px, ${geo.mid.y}px)`; };
          if (animate) move(); else instantly(el.tag, move);
        }
        if (ok) {
          const half = el.l.label ? (el.l.label.length * 7 + 18) / 2 : 0;
          xs.push(...geo.xs, geo.mid.x - half, geo.mid.x + half);
        }
      }
      const x1 = Math.min(...xs) - PAD, x2 = Math.max(...xs) + PAD, y1 = Math.min(...ys) - PAD, y2 = Math.max(...ys) + PAD;
      vb = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
      setZoom(zoom);
      if (cur) paint(cur, null);
    }
    // the viewport is at most 60% of the window tall (see .mm-viewport), so fit to that
    const fitZoom = () => Math.min(1, (viewport.clientWidth - 4) / vb.w, (window.innerHeight * 0.6 - 4) / vb.h);
    function setZoom(z) {
      // default: fit the whole map, unless that makes text too small to read; then scroll
      zoom = z;
      const eff = z ?? Math.max(fitZoom(), Math.min(1, READABLE));
      svg.style.width = `${vb.w * eff}px`;
      svg.style.height = `${vb.h * eff}px`;
    }
    const effZoom = () => vb.w ? svg.getBoundingClientRect().width / vb.w : 1;
    function scrollTo(label, smooth) {
      const P = lay.pos.get(label), z = effZoom();
      viewport.scrollTo({
        left: (P.x - vb.x) * z - viewport.clientWidth / 2,
        top: (P.y - vb.y) * z - viewport.clientHeight / 2,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
    button('−', 'Zoom out', () => setZoom(Math.max(MIN_ZOOM, effZoom() / 1.25)));
    button('Fit', 'Fit the whole map', () => setZoom(fitZoom()));
    button('+', 'Zoom in', () => setZoom(Math.min(MAX_ZOOM, effZoom() * 1.25)));
    button('Unfold all', 'Unfold every branch', () => { collapsed.clear(); applyLayout(true); });
    button('Fold all', 'Fold every branch to its first level', () => {
      for (const c of root.children) if (c.children.length) collapsed.add(c.label);
      applyLayout(true);
    });

    function fold(n, on) {
      if (on) collapsed.add(n.label); else collapsed.delete(n.label);
      applyLayout(true);
      if (selected && !lay.visible.has(selected.label)) closeNote();
    }

    // ---------- note card ----------
    function openNote(n) {
      if (selected) delete N.get(selected.label).g.dataset.selected;
      selected = n;
      N.get(n.label).g.dataset.selected = '';
      card.replaceChildren();
      const close = htmlEl('button', 'mm-note-close', card);
      close.textContent = '×';
      close.title = 'Close';
      close.addEventListener('click', closeNote);
      htmlEl('div', 'mm-note-path', card).textContent = pathTo(n).reverse().join(' › ');
      htmlEl('h3', '', card).textContent = n.label;
      const p = htmlEl('p', n.note ? '' : 'mm-note-empty', card);
      p.textContent = n.note || 'No note for this idea yet.';
      if (n.children.length) htmlEl('div', 'mm-note-meta', card).textContent = `${count(n)} ideas below it`;
      card.hidden = false;
      retrigger(card, 'rise');
    }
    function closeNote() {
      if (selected) delete N.get(selected.label).g.dataset.selected;
      selected = null;
      card.hidden = true;
    }

    // ---------- step state → classes ----------
    function paint(s, p) {
      const onPath = new Set(s.focus ? pathTo(byLabel.get(s.focus)) : []);
      for (const n of all) {
        const { g, inner } = N.get(n.label);
        const shown = s.shown.includes(n.label);
        const change = () => g.classList.toggle('shown', shown);
        if (p) change(); else instantly(inner, () => instantly(g, change));
        if (s.focus === n.label) g.dataset.focus = ''; else delete g.dataset.focus;
        if (p && s.focus === n.label && p.focus !== n.label && p.shown.includes(n.label)) retrigger(inner, 'pop');
        const e = E.get(n.label);
        if (e) {
          const change = () => { e.g.classList.toggle('shown', shown); e.g.classList.toggle('on-path', onPath.has(n.label)); };
          if (p) change(); else instantly(e.g, change);
        }
      }
      const keys = new Set(s.links.map(linkKey));
      for (const [k, el] of L) {
        const change = () => el.g.classList.toggle('shown', keys.has(k));
        if (p) change(); else instantly(el.g, change);
        if (p && keys.has(k) && !p.links.some((l) => linkKey(l) === k)) retrigger(el.g, 'rise');
      }
    }

    function render(s, p) {
      cur = s;
      // a step that moves the focus into a folded branch unfolds it
      let unfolded = false;
      if (s.focus && (!p || p.focus !== s.focus)) {
        for (let x = byLabel.get(s.focus); x; x = x.parent) if (collapsed.delete(x.label)) unfolded = true;
      }
      if (!lay || unfolded) applyLayout(!!p && !!lay);
      paint(s, p);
      if (!p || s.focus !== p.focus) scrollTo(s.focus || root.label, !!p);
    }

    return { render };
  }

  register('mindmap', {
    place: 'stage',
    verbs: ['grow', 'focus', 'link'],
    state: (def) => ({ shown: [treeOf(def).root.label], focus: null, links: [] }),
    apply(s, verb, op, def) {
      const tree = treeOf(def);
      const show = (label) => { if (!s.shown.includes(label)) s.shown.push(label); };
      if (verb === 'grow') {
        const n = need(tree, op.at);
        pathTo(n).forEach(show);
        if (op.deep) (function all(x) { show(x.label); x.children.forEach(all); })(n);
        s.focus = n.label;
      } else if (verb === 'focus') {
        if (op.at == null) { s.focus = null; return; }
        pathTo(need(tree, op.at)).forEach(show);
        s.focus = op.at;
      } else {
        for (const k of ['from', 'to']) pathTo(need(tree, op[k])).forEach(show);
        s.links.push(op.label ? { from: op.from, to: op.to, label: op.label } : { from: op.from, to: op.to });
      }
    },
    View: MindmapView,
  });
})();
