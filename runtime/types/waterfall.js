// Scene type: waterfall — a total built from a base value plus adjustments, one bar per step.
// The first bar is the base; later bars float from the running total; `total` sums them.
//
// scene: { type: "waterfall", title?, currency?: "$" }
// ops:   { bar: "<scene>", label, value }   (negative value = reduction)
//        { total: "<scene>", label? }
(() => {
  'use strict';
  const { register, htmlEl, retrigger, instantly } = VSM;

  // each row's span [a, b] on the value axis
  function spans(rows) {
    let run = 0;
    return rows.map((r) => {
      if (r.kind === 'total') return { ...r, a: 0, b: r.value };
      if (r.kind === 'base') { run = r.value; return { ...r, a: 0, b: r.value }; }
      const a = run;
      run += r.value;
      return { ...r, a, b: run };
    });
  }

  function WaterfallView(id, def, mount, ctx) {
    const cur = def.currency ?? '';
    let max = 1; // fixed scale across all steps and scenarios, so bars never rescale mid-story
    for (const s of ctx.snaps) for (const r of spans(s.rows)) max = Math.max(max, r.a, r.b);
    const pct = (v) => `${(v / max) * 100}%`;
    const fmt = (r) => {
      const n = Math.abs(r.value).toLocaleString();
      return r.kind === 'up' ? `+${cur}${n}` : r.kind === 'down' ? `−${cur}${n}` : `${cur}${n}`;
    };

    const list = htmlEl('div', 'wf', mount);
    const els = [];

    function render(s, p) {
      const rows = spans(s.rows);
      while (els.length > rows.length) els.pop().row.remove();
      rows.forEach((r, i) => {
        let e = els[i];
        const isNew = !e;
        if (isNew) {
          const row = htmlEl('div', 'wf-row', list);
          const top = htmlEl('div', 'wf-top', row);
          e = els[i] = {
            row,
            label: htmlEl('span', 'wf-label', top),
            val: htmlEl('span', 'wf-val', top),
            bar: htmlEl('div', 'wf-bar', htmlEl('div', 'wf-track', row)),
          };
        }
        e.row.dataset.kind = r.kind;
        e.label.textContent = r.label;
        e.val.textContent = fmt(r);
        const set = () => {
          e.bar.style.left = pct(Math.min(r.a, r.b));
          e.bar.style.width = pct(Math.abs(r.b - r.a));
        };
        if (p && isNew) { // grow out of the running total
          instantly(e.bar, () => { e.bar.style.left = pct(r.a); e.bar.style.width = '0%'; });
          retrigger(e.row, 'rise');
        }
        if (p) set(); else instantly(e.bar, set);
      });
    }
    return { render };
  }

  register('waterfall', {
    place: 'side',
    verbs: ['bar', 'total'],
    state: () => ({ rows: [] }),
    apply(s, verb, op) {
      const parts = s.rows.filter((r) => r.kind !== 'total');
      if (verb === 'bar') {
        const kind = parts.length === 0 ? 'base' : op.value >= 0 ? 'up' : 'down';
        s.rows.push({ label: op.label, value: op.value, kind });
      } else {
        s.rows.push({ label: op.label || 'Total', value: parts.reduce((t, r) => t + r.value, 0), kind: 'total' });
      }
    },
    View: WaterfallView,
  });
})();
