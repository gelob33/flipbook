// visual show me — core: shared helpers and the scene-type registry.
// Loaded first. Scene types (types/*.js) register themselves; the player only talks to
// the registry, so adding a type never means editing the player.
window.VSM = (() => {
  'use strict';

  const SVGNS = 'http://www.w3.org/2000/svg';

  // ---------- registry ----------
  // A scene type is { place, verbs, state(def), apply(s, verb, op, def), View(id, def, mount, ctx) }.
  //   place  'stage' | 'side'     default column for its panel
  //   verbs  op names it owns     e.g. ['token']: { token: "<scene id>", at: "node" }
  //   state  initial state        must be structuredClone-able
  //   apply  mutates state for one op
  //   View   draws into mount, returns { render(s, prev), chips?(s) }; prev is null on a fresh frame
  //   target optional (verb, op) => scene id; default is op[verb]
  const types = {};
  const verbOwner = {};
  function register(name, type) {
    for (const key of ['verbs', 'state', 'apply', 'View']) {
      if (!type[key]) throw new Error(`Scene type "${name}" is missing "${key}"`);
    }
    for (const verb of type.verbs) {
      if (verbOwner[verb]) throw new Error(`Verb "${verb}" is claimed by both "${verbOwner[verb]}" and "${name}"`);
      verbOwner[verb] = name;
    }
    types[name] = { place: 'stage', target: (verb, op) => op[verb], ...type };
  }

  // ---------- DOM ----------
  function svgEl(tag, attrs = {}, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }
  function htmlEl(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  // ---------- motion ----------
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // restart a CSS animation class (pop, hop, rise, flash…)
  function retrigger(node, cls) {
    node.classList.remove(cls);
    void node.getBoundingClientRect(); // force reflow so the animation restarts
    node.classList.add(cls);
  }
  // apply style changes without their CSS transition (first frames, jumps)
  function instantly(node, change) {
    node.style.transition = 'none';
    change();
    void node.getBoundingClientRect();
    node.style.transition = '';
  }
  function place(node, x, y, instant) {
    const set = () => { node.style.transform = `translate(${x}px, ${y}px)`; };
    if (instant) instantly(node, set); else set();
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // ---------- the cartoon look ----------
  // hand-drawn wobble: displace outlines with low-frequency noise
  function addWobble(svg, id, scale = 3.5) {
    const defs = svgEl('defs', {}, svg);
    const f = svgEl('filter', { id, x: '-10%', y: '-10%', width: '120%', height: '120%' }, defs);
    svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.035', numOctaves: '2', seed: '7', result: 'noise' }, f);
    svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'noise', scale, xChannelSelector: 'R', yChannelSelector: 'G' }, f);
    return `url(#${id})`;
  }
  // a shape with an offset ink shadow underneath — the basic unit of the look; returns the body
  function sticker(parent, tag, attrs, { offset = 4, cls = 'body' } = {}) {
    svgEl(tag, { ...attrs, class: 'shadow', transform: `translate(${offset} ${offset})` }, parent);
    return svgEl(tag, { ...attrs, class: cls }, parent);
  }

  // ---------- text ----------
  function wrap(text, max) {
    const lines = [];
    let line = '';
    for (const word of String(text).split(/\s+/)) {
      if (!line) line = word;
      else if (line.length + 1 + word.length <= max) line += ' ' + word;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    return lines;
  }
  // multi-line SVG text, vertically centred on cy
  function textLines(textEl, lines, x, cy, lineHeight = 16) {
    lines.forEach((l, i) => {
      svgEl('tspan', { x, y: cy + (i - (lines.length - 1) / 2) * lineHeight }, textEl).textContent = l;
    });
    return textEl;
  }

  return {
    types, verbOwner, register,
    svgEl, htmlEl,
    reduceMotion, retrigger, instantly, place, lerp, easeInOut,
    addWobble, sticker,
    wrap, textLines,
  };
})();
