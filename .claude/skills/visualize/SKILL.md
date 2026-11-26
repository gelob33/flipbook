---
name: visualize
description: Turn a concept, process, procedure or algorithm into an animated, step-through visualisation (cartoon style, Back/Play/Next, captions) using the local "visual show me" player. Use when the user says "visualize", "visualise", "animate", "step through", "show me visually / animated", "storyboard", "algorithm animation", "explorable", or asks to see how a flow, process, state change, algorithm or data structure works step by step. Also for turning an existing Mermaid/PlantUML diagram or a process description into an animation.
---

# visualize

Make a step-through visualisation by writing **one spec file** for the local player. Never write
HTML/CSS/JS for a visualisation — the player and scene types already exist; you only write data.

## Where things live

- App root: the root of this repository (the folder that contains `.claude/skills/visualize/`).
  All paths and commands below are relative to it.
- Player + scene types: `runtime/` (`runtime/types/*.js`, one file per scene type)
- Specs (output): `specs/<kebab-name>.js` — one per visualisation
- CLI: `node tools/vsm.mjs check <name> [--all]` and `node tools/vsm.mjs open <name> [--scenario N] [--step N]`

## Before writing: read the source of truth

1. Read the header comment of every file in `runtime/types/` — it is the exact spec reference
   (scene fields and ops) for that type. Do not rely on memory; types get added and changed.
2. Read one existing spec as a worked example: `specs/binary-search.js` (single scenario, code panel)
   or `specs/motor-insurance-quote.js` (flow + card + waterfall, several scenarios, shared steps).

## Workflow

### 1. Classify — what *kind* of thing is it?

| The subject has… | Use |
|---|---|
| actors/roles, ordered steps, decisions | `flow` (lanes = actors; `shape: "decision"` for branch points) |
| a record/data that accumulates along the way | `card` (fields fill in, status badge) |
| a number built up from parts (price, score, time, cost) | `waterfall` |
| an algorithm over a list / indexes / pointers | `array` (+ `code` lines, `var` ops) |
| ideas and how they group and connect (a topic, a plan, a summary) | `mindmap` (outline in the scene; `grow` a branch per step; `link` ties ideas across branches) |
| states and transitions | `flow` for now (one lane, nodes = states, edge labels = events) |
| messages between people or systems, in time order (calls, requests and replies) | `sequence` (actors = columns; `send` ops; `reply: true` for answers; `from === to` for work done inside) |
| a step that hides its own detail (the work behind a state, the tasks inside a task) | a **child spec** one level down, linked with `opens: "<spec>"` on the `flow` node. Level 1 says what state it's in, level 2 what work happens, level 3 who talks to whom. The child's first caption says which box it opened from; each of its endings says which level-1 event it fires. Example: `order-state-machine` → `take-payment` |

Combine types freely: one scene can be several panels (flow on the stage, card + waterfall on the side).
If nothing fits well, **say so** and propose a new scene type (a new file in `runtime/types/` that
calls `VSM.register`) — don't contort the spec. Building a type is a separate, confirmed task.

#### Pick, say why, and ask only when it's a close call

Many subjects can be drawn more than one way. Test the request against three questions:

| Question the user wants answered | Diagram | Example request |
|---|---|---|
| What state is it in now? | state machine (`flow`, nodes = states) | "how does an order's status change?" |
| What work happens, and who does it? | process (`flow`, lanes = actors, boxes = verbs) | "what happens when someone pays?" |
| Who sends what to whom, in order? | `sequence` (columns = who, arrows = messages) | "what calls go between the shop and the bank?" |

- **Clear fit** (the request points at one question, or it's an algorithm, a list, a number built
  from parts): pick it, say why in one line, and carry on. E.g. "Binary search works on a sorted
  list, so I'll use an array diagram."
- **Close call** (the request fits two or three, e.g. "show me how an online order works"): stop
  and ask with AskUserQuestion. Give each option with what it would show, using the subject's own
  words, and recommend one. E.g. "**State machine** — where the order is now (Cart → Paid →
  Shipped); **process** — who does what to take payment; **sequence** — the messages between shop,
  gateway and bank."
- **Big subject** (several questions matter): offer a level plan instead of one diagram, e.g. level
  1 state machine → level 2 process for one state → level 3 sequence for one task (see the levels
  row above). Build level 1 first.

#### From a document — STRICT: the document is the only source

When the user points at a document ("a mind map of X from docs/y.md", an attached PDF, a pasted
text), the visualisation must show **what the document says**, not what Claude knows. The user
needs to trust that every idea came from their source. This rule overrides "always give an
example" and every other habit: no example, label, link or step may come from outside the document
unless it is marked.

1. **Read the whole document first** (Read tool; PDFs by page; `.docx` via the docx skill). Never
   send it anywhere else.
2. **Scope to the concept the user named.** Only the parts of the document about it. Something
   elsewhere in the document that touches it becomes a cross-link (`link`) or a mention, not a
   branch. If the concept could mean two things in this document, ask which (AskUserQuestion),
   quoting where each meaning appears.
3. **Every idea, label and note traces to the document.**
   - Use the document's own terms for labels. Don't rename "Quote portal" to "Front end".
   - Mind map notes paraphrase or quote the document and end with where it is, e.g.
     "(§3 Pricing)", "(p. 12)", "(heading: Levels)".
   - Other diagram types: the `subtitle` names the document (e.g. "From docs/feature-map.md");
     captions cite the section when they state a specific fact.
   - Examples in captions come from the document. If it has none, give no example rather than
     invent one.
4. **Nothing added silently.** If the story needs something the document doesn't say (a missing
   step, a definition), either leave it out or mark it plainly as "(not in the doc)", in the note
   or caption itself. Never present an assumption as the document's content.
5. **Gaps and contradictions are findings.** If the document is unclear, silent or contradicts
   itself on the concept, don't smooth it over: tell the user, and show it where useful (e.g. a
   note: "The doc doesn't say who approves this").
6. **Big concepts:** more than about 40 ideas → start with deep branches folded (`collapsed`) so
   the first view stays readable; the 15-step cuts apply as usual.

#### Starting from an existing diagram (import)

If the user gives Mermaid, PlantUML or a markdown outline, don't redraw it by hand. Save the text
to a file in the scratchpad (never send it anywhere) and run:

```bash
node tools/vsm.mjs import <file> --name <kebab-name>
```

It reads Mermaid `stateDiagram` / `flowchart` / `sequenceDiagram` / `mindmap`, PlantUML state /
activity / sequence / `@startmindmap`, and markdown bullets or `#` headings, and writes
`specs/<name>.js` with the diagram and one step per state, message or branch. Every caption is a
`TODO`. Then carry on from step 2 as usual: storyboard, rewrite every caption, add scenarios for
the other paths, tones for end states, `link` ops in mind maps. Read its `!` warnings: they list
what was skipped (notes, alt/loop boxes, nested states, activity loops).

### 2. Storyboard — plan every step before any spec

List the actors/lanes, decisions and their outcomes, data that appears, and numbers involved. Then
write a storyboard table, one row per step, before you write the spec:

| # | What changes on screen | Caption |
|---|---|---|
| 1 | Token at "Start a quote"; card status Draft | A customer starts a quote online… |

If a row has two things changing for two reasons, split it. Fix the story here, where it is cheap;
the spec is a translation of this table.
If the subject is the user's real system, take it from their code/docs/diagrams (Mermaid or PlantUML
text is just input — parse it yourself, **never send diagrams to any server**). If generic, say so in
the `subtitle` and label numbers as illustrative.

### 3. Story — this is what makes it teach

- **Happy path first**, as its own scenario. Branches (errors, rejections, edge cases) become extra
  `scenarios` that share the common opening steps.
- **One idea per step.** 6–15 steps per scenario, never more than 15: past that, people lose the
  thread. Split a step if its caption needs "and then".
- **Too many steps? Cut in this order** (scenarios are for *different paths*, e.g. approved vs
  declined, never for "part 2" of one story):
  1. **Group** steps that make one point into one step, e.g. "the bank checks the card and
     replies" shows both arrows at once.
  2. **Sum up repeats:** show the first pass of a loop in full, then one step per later pass (see
     "Long loops" below).
  3. **Split into levels:** the top level tells the whole story in ≤ 15 steps; the detail goes in
     child specs opened with `opens` (e.g. `order-state-machine` → `take-payment` →
     `payment-messages`).
  4. **Split into parts** when there's no detail to push down (e.g. a 40-step onboarding):
     separate specs titled "… (part 1 of 3)", each ≤ 15 steps, with the last caption of each part
     naming the next spec.
  Say in one line which cut you used and why.
- **Captions explain *why*, not just what** ("Rules run before pricing so…", not "Rules run.").
  1–2 sentences, plain language, ELI5-friendly.
- **Always give a concrete example.** Every caption that describes an action or concept includes a
  specific one: the exact command to type, a real value, a named file, a familiar case ("e.g. …").
  Show inputs the reader would type on a `card` field so they build up step by step.
- **Answer where / what / which.** Don't leave vague nouns ("your description", "real files",
  "the tool"): say where it happens (e.g. "Claude Code's prompt box"), what goes in, which files.
  Re-read each caption as a newcomer and fix any line that raises a question.
- Keep labels short: node labels ≲ 25 chars, card keys one word, lane names ≲ 2 words.

### 4. Write the spec — `specs/<kebab-name>.js`

- It's a JS file that sets `window.VIZ = { title, subtitle?, code?, scene, steps | scenarios }`.
- **DRY inside the spec:** wrap it in `(() => { … })();` and use small functions/constants for steps
  shared between scenarios (see `intake()` in the insurance spec).
- **Algorithms: don't hand-write long traces.** Write the algorithm in the spec file itself and have
  it push steps as it runs (e.g. a bubble sort that emits `mark`/`set`/`pointer` ops per comparison),
  so the steps are correct by construction.
- **Long loops: show the first pass in full, then sum up.** E.g. bubble sort on 8 items: step through
  pass 1 one comparison at a time, then show each later pass as one step ("pass 2: 5 moves to the
  end"). Keep the whole scenario within 15 steps.
- Check the name isn't already taken in `specs/` (don't overwrite a spec unless asked).

### 5. Check — run the real player, then look

```bash
node tools/vsm.mjs check <name>
```

- Non-zero exit = broken spec; the message names the scenario, step and op. Fix and re-run.
- Then **Read the screenshots** it lists and look for: overlapping or cramped labels, text wrapping
  badly, edges crossing nodes, empty or confusing panels, captions that don't match the frame.
  Fix the spec (shorter labels, `col` to pin a node's column, reorder lanes) and re-check.
- For tricky middles, `--all` screenshots every step.
- **Made from a document? Check every claim against it** before handing over: go through each
  label, note and caption and find it in the document. Fix or mark "(not in the doc)" anything you
  can't find; fix any section reference that points to the wrong place.

### 6. Open and hand over

```bash
node tools/vsm.mjs open <name>
```

Tell the user: what it shows, the scenarios, anything illustrative/assumed, and the spec path in case
they want to tweak captions. Keep it short. Made from a document: also say which sections it drew
on, list anything marked "(not in the doc)", and any gaps or contradictions you found.

## Writing rules (George Orwell's six, from "Politics and the English Language")

Apply to every caption, label, title and subtitle:

1. Never use a stock metaphor, simile or figure of speech ("the heart of", "under the hood").
2. Never use a long word where a short one will do ("use", not "utilise"; "check", not "validate").
3. If you can cut a word, cut it.
4. Never use the passive where you can use the active ("Claude reads the file", not "the file is read").
5. Never use a foreign phrase, scientific word or jargon if an everyday word will do. When a term is
   the point (e.g. teaching "binary search"), name it once and explain it in plain words with an example.
6. Break any of these rules sooner than say anything outright barbarous.

## Style rules (the user's preferences)

- The look lives in `runtime/player.css` — never restyle per spec.
- No celebrations/confetti, no handwritten fonts.
- Everything local: no CDNs, no external services.
