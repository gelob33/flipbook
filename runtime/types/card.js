// Scene type: card — a record that fills in field by field, with a status badge.
//
// scene: { type: "card", title }
// ops:   { field: "<scene>", key, value | null }
//        { status: "<scene>", value | null, tone?: "neutral" | "good" | "warn" | "bad" }
(() => {
  'use strict';
  const { register, htmlEl, retrigger } = VSM;

  function CardView(id, def, mount) {
    const head = htmlEl('div', 'card-head', mount);
    htmlEl('span', 'card-title', head).textContent = def.title || id;
    const badge = htmlEl('span', 'badge', head);
    const list = htmlEl('div', 'card-rows', mount);
    const rows = new Map();

    function render(s, p) {
      badge.hidden = !s.status;
      if (s.status) {
        badge.textContent = s.status.value;
        badge.dataset.tone = s.status.tone || 'neutral';
        if (p && (!p.status || p.status.value !== s.status.value)) retrigger(badge, 'pop');
      }
      for (const [k, r] of rows) if (!s.fields.has(k)) { r.el.remove(); rows.delete(k); }
      for (const [k, v] of s.fields) {
        let r = rows.get(k);
        if (!r) {
          const el = htmlEl('div', 'card-row');
          htmlEl('span', 'k', el).textContent = k;
          r = { el, v: htmlEl('span', 'v', el) };
          rows.set(k, r);
        }
        list.appendChild(r.el); // keeps display order = insertion order
        if (r.v.textContent !== String(v)) {
          r.v.textContent = v;
          if (p) retrigger(r.el, 'flash');
        }
      }
    }
    return { render };
  }

  register('card', {
    place: 'side',
    verbs: ['field', 'status'],
    state: () => ({ fields: new Map(), status: null }),
    apply(s, verb, op) {
      if (verb === 'field') { if (op.value == null) s.fields.delete(op.key); else s.fields.set(op.key, op.value); }
      else s.status = op.value == null ? null : { value: op.value, tone: op.tone };
    },
    View: CardView,
  });
})();
