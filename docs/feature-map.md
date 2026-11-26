# Feature map

Features we plan to build. Each one says what it is, an example, where the code goes, and what is
still open. Source: a `/reframe` run on this repo (2026-11-26).

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

## Levels: side by side

**Done first:** option A, click to open. A `flow` node with `opens: "<spec>"` gets a ⊕ badge;
clicking it opens the child spec in the same tab with a breadcrumb back to the parent's step
(e.g. `order-state-machine` → `take-payment`).

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
