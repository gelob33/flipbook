// Turn diagram text (Mermaid, PlantUML, markdown outline) into a visual show me spec.
// Everything runs locally: nothing is sent anywhere.
//
// importDiagram(text) → { kind, spec, warnings }
//   kind: "state" | "flow" | "sequence" | "mindmap"
//   spec: a plain object for window.VIZ, with generated steps and placeholder captions
//         ("TODO: …") that /visualize rewrites.
//
// Supported:
//   state     Mermaid stateDiagram(-v2); PlantUML @startuml with [*] or `state`
//   flow      Mermaid flowchart / graph (subgraph → lane); PlantUML activity
//             (start, :task;, if/else/endif, |lane|, stop)
//   sequence  Mermaid sequenceDiagram; PlantUML @startuml with -> messages
//   mindmap   Mermaid mindmap; PlantUML @startmindmap; markdown bullets or # headings
// Not supported yet (warned about, then skipped): notes, alt/loop/opt boxes, nested states,
// activity loops (while/repeat), styling.

const MAX_STEPS = 15;
const TODO = (what) => `TODO: say what happens and why — ${what}.`;

// ---------- detect ----------
function detect(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('%%') && !l.startsWith("'"));
  const first = (lines[0] || '').toLowerCase();
  const body = lines.join('\n');
  if (/^statediagram/.test(first)) return 'state';
  if (/^(flowchart|graph)\b/.test(first)) return 'flow';
  if (/^sequencediagram/.test(first)) return 'sequence';
  if (/^mindmap/.test(first) || /^@startmindmap/.test(first)) return 'mindmap';
  if (/^@startuml/.test(first)) {
    if (/\[\*\]|^state\s/m.test(body)) return 'state';
    if (/^(start|:.*;|if\s*\()/m.test(body)) return 'flow';
    if (/^\S+\s*-+>>?\s*\S+/m.test(body)) return 'sequence';
    throw new Error('PlantUML diagram type not recognised (supported: state, activity, sequence, mindmap)');
  }
  if (/^\s*([-*+]\s|#)/m.test(text)) return 'mindmap';
  throw new Error('Unknown diagram text. Supported: Mermaid stateDiagram / flowchart / sequenceDiagram / mindmap, PlantUML state / activity / sequence / mindmap, markdown outline.');
}

const stripUml = (text) => text.split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !/^@(start|end)\w*/.test(l) && !l.startsWith("'") && !l.startsWith('%%') && !/^(skinparam|title|hide|left to right|top to bottom)/i.test(l));

// ---------- flow-shaped output (state machines and flow charts) ----------
function makeIds() {
  const ids = new Map(); // label or source id → spec id
  return (key, name = key) => {
    if (!ids.has(key)) {
      const base = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'n';
      let id = base, i = 2;
      while ([...ids.values()].includes(id)) id = `${base}-${i++}`;
      ids.set(key, id);
    }
    return ids.get(key);
  };
}

// the steps: start at the first node and follow the first way out of each node, once
function walkSteps(nodes, edges, start, token) {
  const steps = [{ say: TODO(`it starts at "${nodes[start].label}"`), do: [{ token, at: start }] }];
  const seen = new Set([start]);
  let at = start;
  while (steps.length < MAX_STEPS) {
    const e = edges.find(([a, b]) => a === at && !seen.has(b));
    if (!e) break;
    const [, b, label] = e;
    steps.push({ say: TODO(`${nodes[at].label} → ${nodes[b].label}${label ? ` (${label})` : ''}`), do: [{ token, at: b }] });
    seen.add(b);
    at = b;
  }
  return steps;
}

function flowSpec(title, nodes, edges, lanes, start, warnings) {
  if (!Object.keys(nodes).length) throw new Error('No states or steps found');
  start = start || Object.keys(nodes)[0];
  const scene = { flow: { type: 'flow', ...(lanes.length ? { lanes } : {}), nodes, edges } };
  const steps = walkSteps(nodes, edges, start, 'flow');
  if (edges.some(([a, b]) => a !== b && edges.filter(([x]) => x === a).length > 1)) {
    warnings.push('Only the first path is stepped through. Add the other branches as extra scenarios.');
  }
  return { title, scene, steps };
}

// ---------- state machines ----------
function importState(text, warnings) {
  const id = makeIds();
  const nodes = {}, edges = [];
  let start = null;
  const ends = new Set();
  const node = (key, label) => {
    const k = id(key);
    if (!nodes[k]) nodes[k] = { label: label || key };
    else if (label) nodes[k].label = label;
    return k;
  };
  let depth = 0;
  for (const line of stripUml(text)) {
    if (/^statediagram/i.test(line)) continue;
    if (/^note\b/i.test(line)) { warnings.push(`Skipped a note: ${line}`); continue; }
    if (/\{\s*$/.test(line)) { depth++; warnings.push(`Nested states flattened: ${line} (consider a lower level with \`opens\`)`); continue; }
    if (/^\}$/.test(line)) { depth--; continue; }
    let m;
    if ((m = line.match(/^state\s+"([^"]+)"\s+as\s+(\S+)/i))) { node(m[2], m[1]); continue; }
    if ((m = line.match(/^state\s+(\S+)\s*:\s*(.+)$/i)) || (m = line.match(/^state\s+(\S+)$/i))) { node(m[1], m[2]); continue; }
    if ((m = line.match(/^(\S+)\s*-+>\s*(\S+)\s*(?::\s*(.+))?$/))) {
      const [, a, b, label] = m;
      if (a === '[*]' && b === '[*]') continue;
      if (a === '[*]') { start = start || node(b); continue; }
      if (b === '[*]') { ends.add(node(a)); continue; }
      edges.push(label ? [node(a), node(b), label.trim()] : [node(a), node(b)]);
      continue;
    }
    if ((m = line.match(/^(\S+)\s*:\s*(.+)$/))) { node(m[1]); warnings.push(`Skipped a state description: ${line}`); continue; }
    if (/^(direction|\[\*\])/i.test(line)) continue;
    warnings.push(`Skipped: ${line}`);
  }
  if (ends.size) warnings.push(`End states: ${[...ends].map((k) => nodes[k].label).join(', ')}. Give them a tone (good/warn/bad) if it helps.`);
  return flowSpec('Imported state machine', nodes, edges, [], start, warnings);
}

// ---------- flow charts: Mermaid ----------
const SHAPES = [ // Mermaid node shapes, longest first
  [/^\(\[(.*)\]\)$/, null], [/^\(\((.*)\)\)$/, null], [/^\[\[(.*)\]\]$/, null], [/^\{\{(.*)\}\}$/, 'decision'],
  [/^\[\((.*)\)\]$/, null], [/^\[\/(.*)\/\]$/, null], [/^\[\\(.*)\\\]$/, null], [/^>(.*)\]$/, null],
  [/^\{(.*)\}$/, 'decision'], [/^\[(.*)\]$/, null], [/^\((.*)\)$/, null],
];
function importMermaidFlow(text, warnings) {
  const id = makeIds();
  const nodes = {}, edges = [], lanes = [];
  let lane = null;
  const node = (raw) => {
    const m = raw.trim().match(/^([\w.-]+)(.*)$/);
    if (!m) throw new Error(`Can't read node "${raw}"`);
    const [, key, shapeText] = m;
    const k = id(key);
    if (!nodes[k]) nodes[k] = { label: key };
    for (const [re, shape] of SHAPES) {
      const s = shapeText.trim().match(re);
      if (s) {
        nodes[k].label = s[1].replace(/^"|"$/g, '').trim();
        if (shape) nodes[k].shape = shape;
        break;
      }
    }
    if (lane && !nodes[k].lane) nodes[k].lane = lane;
    return k;
  };
  const ARROW = /\s*(?:-->|---|-\.->|==>|--\s+(?<l1>[^-].*?)\s+-->|-\.\s*(?<l2>.+?)\s*\.->)\s*(?:\|(?<l3>[^|]*)\|)?\s*/;
  for (let line of text.split('\n').slice(1)) {
    line = line.trim().replace(/;$/, '');
    if (!line || line.startsWith('%%')) continue;
    let m;
    if ((m = line.match(/^subgraph\s+(?:\S+\s*\[(.+)\]|"?([^"]+)"?)$/))) { lane = (m[1] || m[2]).trim(); if (!lanes.includes(lane)) lanes.push(lane); continue; }
    if (line === 'end') { lane = null; continue; }
    if (/^(classDef|class|style|linkStyle|click|direction)\b/.test(line)) { warnings.push(`Skipped styling: ${line}`); continue; }
    // a chain: A --> B --> C, with optional labels
    const parts = [];
    let rest = line;
    while ((m = rest.match(ARROW)) && m.index > 0) {
      parts.push({ node: rest.slice(0, m.index) });
      parts.push({ label: (m.groups.l1 || m.groups.l2 || m.groups.l3 || '').trim() });
      rest = rest.slice(m.index + m[0].length);
    }
    parts.push({ node: rest });
    const keys = parts.filter((p) => 'node' in p).map((p) => p.node.split('&').map(node));
    const labels = parts.filter((p) => 'label' in p).map((p) => p.label);
    for (let i = 0; i + 1 < keys.length; i++) {
      for (const a of keys[i]) for (const b of keys[i + 1]) edges.push(labels[i] ? [a, b, labels[i]] : [a, b]);
    }
  }
  if (lanes.length) { // nodes outside every subgraph get their own lane
    for (const n of Object.values(nodes)) if (!n.lane) { n.lane = 'Other'; if (!lanes.includes('Other')) lanes.push('Other'); }
  }
  return flowSpec('Imported flow chart', nodes, edges, lanes, null, warnings);
}

// ---------- flow charts: PlantUML activity ----------
function importActivity(text, warnings) {
  const id = makeIds();
  const nodes = {}, edges = [], lanes = [];
  let lane = null, prev = [], label = null, n = 0;
  const stack = [];
  const add = (text, shape) => {
    const k = id(`#${n++}`, text); // the same text can appear twice in a process
    nodes[k] = { label: text, ...(shape ? { shape } : {}), ...(lane ? { lane } : {}) };
    for (const p of prev) edges.push(label ? [p, k, label] : [p, k]);
    label = null;
    prev = [k];
    return k;
  };
  for (const line of stripUml(text)) {
    let m;
    if ((m = line.match(/^\|(.+)\|$/))) { lane = m[1].trim(); if (!lanes.includes(lane)) lanes.push(lane); continue; }
    if (/^start$/i.test(line)) continue;
    if (/^(stop|end|kill|detach)$/i.test(line)) { prev = []; continue; }
    if ((m = line.match(/^:(.*);$/))) { add(m[1].trim()); continue; }
    if ((m = line.match(/^if\s*\((.*?)\)\s*(?:then\s*(?:\((.*?)\))?)?$/i))) {
      const d = add(m[1].trim() + '?'.repeat(m[1].trim().endsWith('?') ? 0 : 1), 'decision');
      stack.push({ d, ends: [], hadElse: false });
      label = m[2] ? m[2].trim() : 'yes';
      continue;
    }
    if ((m = line.match(/^else\s*(?:\((.*)\))?$/i)) || (m = line.match(/^elseif\s*\(.*\)\s*then\s*\((.*)\)$/i))) {
      const f = stack[stack.length - 1];
      if (!f) { warnings.push(`"else" without "if": ${line}`); continue; }
      f.ends.push(...prev); f.hadElse = true;
      prev = [f.d]; label = m[1] ? m[1].trim() : 'no';
      continue;
    }
    if (/^endif$/i.test(line)) {
      const f = stack.pop();
      if (!f) continue;
      prev = [...f.ends, ...prev, ...(f.hadElse ? [] : [f.d])];
      if (!f.hadElse) label = 'no';
      continue;
    }
    if (/^(while|endwhile|repeat|fork|split|partition|note)/i.test(line)) { warnings.push(`Not supported yet, skipped: ${line}`); continue; }
    warnings.push(`Skipped: ${line}`);
  }
  if (lanes.length) for (const v of Object.values(nodes)) if (!v.lane) { v.lane = lanes[0]; }
  return flowSpec('Imported process', nodes, edges, lanes, null, warnings);
}

// ---------- sequence diagrams ----------
function importSequence(text, mermaid, warnings) {
  const actors = {};
  const id = makeIds();
  const actor = (key, label) => {
    const k = id(key);
    if (!actors[k] || label) actors[k] = label || actors[k] || key;
    return k;
  };
  const msgs = [];
  const lines = mermaid ? text.split('\n').slice(1).map((l) => l.trim()).filter(Boolean) : stripUml(text);
  for (const line of lines) {
    let m;
    if ((m = line.match(/^(?:participant|actor|boundary|control|entity|database|collections|queue)\s+(?:"([^"]+)"\s+as\s+(\S+)|(\S+)\s+as\s+(.+)|(\S+))$/i))) {
      if (m[1]) actor(m[2], m[1]); else if (m[3]) actor(m[3], m[4].trim()); else actor(m[5]);
      continue;
    }
    if (/^(note|alt|else|opt|loop|par|and|critical|break|rect|end|group|activate|deactivate|autonumber|==|\.\.\.|\|\|\|)/i.test(line)) {
      if (!/^(end|activate|deactivate|autonumber)/i.test(line)) warnings.push(`Not supported yet, flattened: ${line}`);
      continue;
    }
    m = mermaid
      ? line.match(/^([^\s:>-]+)\s*(-{1,2})(>>|>|x|\))[+-]?\s*([^\s:]+)\s*:\s*(.*)$/)
      : line.match(/^([^\s:>-]+)\s*(-{1,2})(>>|>|\\\\|\/\/|\\|\/)?\s*([^\s:]+)\s*(?::\s*(.*))?$/);
    if (m) {
      const [, a, dashes, , b, label] = m;
      msgs.push({ from: actor(a), to: actor(b), label: (label || '').trim() || '(message)', reply: dashes.length === 2 });
      continue;
    }
    if (/^(sequencediagram|title)/i.test(line)) continue;
    warnings.push(`Skipped: ${line}`);
  }
  if (!msgs.length) throw new Error('No messages found');
  if (msgs.length + 1 > MAX_STEPS) warnings.push(`${msgs.length} messages: more than the 15-step rule. Consider splitting, or one step per few messages.`);
  const steps = [{ say: TODO('who takes part, and what this conversation is for'), do: [] }];
  for (const m of msgs) {
    steps.push({ say: TODO(`${actors[m.from]} → ${actors[m.to]}: ${m.label}`), do: [{ send: 'seq', ...m, ...(m.reply ? {} : { reply: undefined }) }] });
  }
  for (const s of steps) for (const op of s.do) if (op.reply === undefined) delete op.reply;
  return { title: 'Imported sequence', scene: { seq: { type: 'sequence', actors } }, steps };
}

// ---------- mind maps ----------
function importMindmap(text, warnings) {
  const lines = text.split('\n').filter((l) => l.trim());
  const out = []; // [depth, label]
  const shape = (s) => s.replace(/^[\w-]*(\(\((.*)\)\)|\)\)(.*)\(\(|\)(.*)\(|\{\{(.*)\}\}|\[(.*)\]|\((.*)\))$/, (...g) => g.slice(2, 8).find((x) => x != null) ?? s).trim();
  const first = lines[0].trim().toLowerCase();
  if (first === 'mindmap') { // Mermaid: indentation only
    const body = lines.slice(1).filter((l) => !/^\s*::icon\(/.test(l));
    for (const l of body) {
      if (/^\s*:::/.test(l)) continue;
      out.push([l.match(/^\s*/)[0].replace(/\t/g, '    ').length, shape(l.trim())]);
    }
  } else if (first.startsWith('@startmindmap')) { // PlantUML: * / + / - markers give the depth
    for (const l of stripUml(text)) {
      const m = l.match(/^([*+-]+)[_]?\s*(?:\[#[^\]]*\])?\s*(.*)$/);
      if (m) out.push([m[1].length, m[2].trim()]); else warnings.push(`Skipped: ${l}`);
    }
  } else { // markdown: # headings and/or bullets
    let base = 0;
    for (const l of lines) {
      let m;
      if ((m = l.match(/^(#+)\s+(.*)$/))) { base = m[1].length * 100; out.push([base, m[2].trim()]); continue; }
      if ((m = l.match(/^(\s*)[-*+]\s+(.*)$/))) { out.push([base + 1 + m[1].replace(/\t/g, '    ').length, m[2].trim()]); continue; }
      warnings.push(`Skipped: ${l.trim()}`);
    }
  }
  if (!out.length) throw new Error('No ideas found');
  // one root: if there are several top-level ideas, put them under a new centre
  const min = Math.min(...out.map(([d]) => d));
  let rows = out;
  if (out.filter(([d]) => d === min).length > 1) { rows = [[min - 1, 'Main idea'], ...out]; warnings.push('Several top-level ideas: put them under a new centre, "Main idea". Rename it.'); }
  const levels = [...new Set(rows.map(([d]) => d))].sort((a, b) => a - b);
  const seen = new Map();
  const outline = rows.map(([d, label]) => {
    let l = label, i = 2;
    while (seen.has(l)) l = `${label} (${i++})`;
    if (l !== label) warnings.push(`"${label}" appears twice: renamed one to "${l}"`);
    seen.set(l, true);
    return `${'  '.repeat(levels.indexOf(d))}- ${l}`;
  });
  const root = outline[0].replace(/^- /, '');
  const branches = outline.filter((l) => /^ {2}- /.test(l)).map((l) => l.trim().slice(2));
  const steps = [{ say: TODO(`the central idea, "${root}"`), do: [{ focus: 'map', at: root }] }];
  for (const b of branches.slice(0, MAX_STEPS - 2)) steps.push({ say: TODO(`the "${b}" branch`), do: [{ grow: 'map', at: b, deep: true }] });
  if (branches.length > MAX_STEPS - 2) {
    steps.push({ say: TODO('the remaining branches'), do: branches.slice(MAX_STEPS - 2).map((b) => ({ grow: 'map', at: b, deep: true })) });
  }
  steps.push({ say: TODO('the whole map, and how the branches connect (add `link` ops)'), do: [{ focus: 'map', at: null }] });
  return { title: `${root}, as a mind map`, scene: { map: { type: 'mindmap', outline: '\n' + outline.join('\n') } }, steps };
}

export function importDiagram(text) {
  text = text.replace(/\r/g, '').replace(/^```\w*\n|\n```\s*$/g, '').trim();
  const kind = detect(text);
  const warnings = [];
  const first = text.split('\n')[0].trim().toLowerCase();
  let spec;
  if (kind === 'state') spec = importState(text, warnings);
  else if (kind === 'flow') spec = /^@startuml/.test(first) ? importActivity(text, warnings) : importMermaidFlow(text, warnings);
  else if (kind === 'sequence') spec = importSequence(text, !/^@startuml/.test(first), warnings);
  else spec = importMindmap(text, warnings);
  spec.subtitle = 'Imported — rewrite the captions (every one starts with TODO)';
  return { kind, spec, warnings };
}
