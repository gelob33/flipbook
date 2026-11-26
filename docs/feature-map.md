# Feature map

What's built, what's next, and the plan for each feature not built yet. Each plan says what it is,
an example, where the code goes, its size, and what is still open. Last updated 2026-11-26.

## Built

| Feature | Where | Demo |
|---|---|---|
| Scene types: `array`, `flow`, `card`, `waterfall` | `runtime/types/` | `binary-search`, `motor-insurance-quote` |
| State machines in `flow`: self-loops, loops back, labels that avoid boxes and the tag, no hand-pinned columns | `runtime/types/flow.js` | `order-state-machine` |
| Optional lanes in `flow` (rows picked automatically); arrows go under boxes they would cross | `runtime/types/flow.js` | imported flow charts |
| Levels, click to open: a box with `opens` gets ⊕, opens the child spec, breadcrumb back | `flow.js`, `player.js` | `order-state-machine` → `take-payment` → `payment-messages` |
| Sequence diagrams: lifelines, numbered messages, dashed replies, self-messages | `runtime/types/sequence.js` | `payment-messages` |
| Mind maps: outline in, grow per step, cross-links, fold/unfold, notes on click, zoom and scroll for big maps | `runtime/types/mindmap.js` | `project-mindmap`, `mindmap-stress` (265 ideas) |
| Import: Mermaid, PlantUML and markdown outlines → spec with TODO captions | `tools/import.mjs`, `vsm import` | — |
| Export: one self-contained HTML file to share | `vsm export` | `dist/project-mindmap.html` |
| Skill rules: storyboard first, examples always, Orwell's rules, pick or ask which diagram, 15-step cuts, strict "from a document" | `.claude/skills/visualize/SKILL.md` | — |

## Next up (suggested order)

1. **Try the "from a document" rule on a real document** — a mind map of one concept from a doc
   you know well, to check every idea and note really comes from it. Not code; a test of the skill.
2. **Flow chart shapes** — small.
3. **Sequence: notes and boxes**, then import them — medium.
4. **Import nested states as levels** — medium.
5. **Export with levels** — small–medium.
6. **Guess first** — medium.
7. **Swap boxes in arrays** — medium.

Bigger, later: levels side by side, automatic levels, parallel paths (BPMN), explorable inputs,
the web app.

---

## Flow chart shapes

**What:** oval start/end boxes for flow charts, and BPMN event circles (start, end, timer).
Today ends are shown with colour (`tone`) only.

**Example:** `nodes: { start: { label: "Start", shape: "terminal" }, wait: { label: "2 days", shape: "timer" } }`

**Where:** `runtime/types/flow.js` (draw the shapes, keep anchors right); `tools/import.mjs` maps
Mermaid `([Start])` / `((…))` and PlantUML `start` / `stop` to them.

**Size:** small.

## Sequence: notes and boxes

**What:** what the `sequence` type lacks compared with standard sequence diagrams:
- **notes** — a sticky note on a lifeline, e.g. "the card number never reaches the shop";
- **boxes** (`alt` / `opt` / `loop`) — a labelled frame round some messages, e.g. "if 3-D Secure
  is needed", so one diagram can show both paths;
- **activation bars** — a thin bar on a lifeline while someone is busy;
- **people vs systems** — a stick figure for a person, a box for a system.

**Where:** `runtime/types/sequence.js` (new ops, e.g. `{ note: "seq", over: "bank", text }`,
`{ box: "seq", label, from: 3, to: 5 }`); then `tools/import.mjs`, which today flattens these and
warns.

**Size:** medium. Notes and boxes first; bars and figures are nice to have.

**Open:** do boxes replace scenarios for "approved vs declined", or sit alongside them?

## Import nested states as levels

**What:** a nested state in Mermaid or PlantUML (`state Paying { … }`) becomes its own child spec,
linked from the parent with `opens`. Today import flattens it and warns.

**Example:** importing an order machine with a nested `Paying` writes `order.js` and
`order-paying.js`; ⊕ on Paying opens the second.

**Where:** `tools/import.mjs` (write several specs from one file).

**Size:** medium.

## Export with levels

**What:** `vsm export` of a spec that links to other levels bundles the whole chain into one file,
so ⊕ still works when shared. Today links to other levels don't work in an export.

**Where:** `tools/vsm.mjs` (follow `opens`, inline every spec); `player.js` (open an inlined spec
instead of loading a file).

**Size:** small–medium.

## Guess first

**What:** a step can ask the viewer a question before it shows the answer. The viewer picks an
option; the player says if they were right, then moves on.

**Why:** watching is easy; guessing makes you think about what comes next.

**Example:** in `binary-search`, before the pointer moves:

```js
{ ask: "Target is 23 and the middle is 16. Which half next?",
  options: ["left", "right"], answer: "right",
  say: "Right: 23 is bigger than 16, so it can only be in the right half.",
  do: [ /* the usual ops */ ] }
```

**Where:** `runtime/player.js` and `runtime/player.css`. It works for every scene type, so no
scene type changes.

**Size:** medium, about 50 lines.

**Open:**
- Does Play stop at a question, or skip it?
- Does a wrong guess let you try again, or just show the answer?

## Swap boxes in arrays

**What:** a `swap` op for the `array` scene type. The two boxes slide past each other, so your eye
can follow a value as it moves. Today a box is fixed to its place and `set` only changes the number
inside it, so a swap looks like two numbers changing.

**Why:** in sorts the point is where values travel (e.g. in bubble sort, big numbers drift to the
end). Watching the box move shows that; reading two changed digits does not.

**Example:** sorting `[5, 2]`:

```js
{ say: "5 is bigger than 2, so they trade places.",
  do: [{ swap: "arr", at: [0, 1] }] }
```

The 5 box slides right and the 2 box slides left.

**Where:** `runtime/types/array.js`. State keeps which box sits in each place; `render` moves boxes
to their new place (the CSS transition on `.cell` already animates the slide). The index numbers
(0, 1, 2…) stay fixed under the places, not on the boxes. Document the op in the file header.

**Size:** medium, about 30 lines.

**Open:**
- Do marks (`compare`, `sorted`) belong to a place or to a box? E.g. after a swap, does "sorted"
  stay on the last place or travel with the box?

## Known rough edges

- **Two branches in one named lane:** when both branches of a decision sit in the same lane (e.g.
  a PlantUML activity with `|Portal|`), their arrows both curve under the boxes and overlap a
  little. Fix: let a lane hold sub-rows, so branches stack inside it.
- **"Fit" on huge mind maps:** at 265 ideas, Fit makes the map too small to read. Folding works;
  a search box that jumps to an idea would help more.

---

## Levels: side by side

**What:** level 1 shrinks to a small map in the side panel, with its tag on the box you opened
(e.g. Paying), while level 2 plays on the main stage. You always see where you are.

**Where:** player loads the parent spec too (from the breadcrumb trail) and draws it read-only in
the side column.

**Size:** medium.

## Levels: automatic (statecharts)

**What:** one Back/Next runs through every level. When level 1's tag enters a state that `opens`
a child, the player steps into the child; when the child ends, it returns and fires the parent
event (e.g. take-payment ends with "paid", so level 1 moves Paying → Paid).

**Example:** each child ending names its parent event: `{ ..., ends: "paid" }`.

**Where:** player (a stack of specs instead of one); `vsm check` checks every ending names a real
event of the parent state.

**Size:** large.

**Open:**
- History: after "retry", does the child start again or resume where it stopped?
- Can a parent event (e.g. "cancel") interrupt the child part-way?

## Parallel paths (BPMN)

**What:** a process that splits into work happening at the same time and joins again, e.g. "pack
the box" and "send the invoice" after payment. Today there is one tag, so it can't split. Also
dashed message arrows between pools.

**Where:** `runtime/types/flow.js` (several tags; `shape: "parallel"` for split/join gateways).

**Size:** large.

## Explorable inputs

**What:** the viewer changes the input and the steps rebuild. Only specs that build their steps from
code can do this (e.g. an algorithm spec), not hand-written ones.

**Example:** in `binary-search`, the viewer types a new target (say 7, which is not in the list)
and steps through the search that fails.

**Where:** a spec exports a function, e.g. `build({ list, target }) → { scene, steps }`, plus a
list of `inputs` to show as fields. The player shows the fields and calls `build` again on change.
`tools/vsm.mjs check` checks the default inputs.

**Size:** large. Design first.

**Open:**
- Which inputs can the viewer change, and how are bad values caught (e.g. an unsorted list for
  binary search)?
- Does the URL keep the inputs, so a link opens the same run?
- How does this fit the planned web app, where specs are JSON only (no code)?

## Web app (planned 2026-11-23, on hold)

**What:** others generate visualisations online. Plan so far: JSON-only specs (no generated code),
the same engine checks specs on the server, progress shown while it works, access by invite code,
and a spend cap.

**Open:** backend language (Node suggested, or Python with uv); hosting (Railway suggested).
Everything else in this map should work in it, so keep specs as data.
