# flipbook - visually show me

![You ask, it plans the story, builds and checks it, and you step through it](docs/hero.png)

Step-through, cartoon-style visualisations of concepts, processes and algorithms.
A visualisation is one **spec** file; the player renders it. No build step, no dependencies, fully local.

```
runtime/            the app — written once
  player.html/.css  page + the cartoon look
  core.js           shared helpers + scene-type registry
  types/*.js        one file per scene type (array, flow, card, waterfall); header = its spec reference
  player.js         replays steps, renders, Back/Play/Next, scenarios
specs/*.js          one file per visualisation (sets window.VIZ)
tools/vsm.mjs       CLI: check (errors + screenshots) and open
docs/               README images
```

## Use

- Ask Claude: `/visualize show me how <thing> works` (skill at `~/.claude/skills/visualize`).
- Open one: `node tools/vsm.mjs open motor-insurance-quote`
  (or `runtime/player.html?spec=<name>&scenario=N&step=N`)
- Check one: `node tools/vsm.mjs check <name> [--all]`
- Keys: ← → step, space play/pause, Home/End.

## Requirements

- A browser (Chrome or Edge) — the player is plain HTML/CSS/JS, opened straight from disk.
- Node.js 18+ for the CLI only (no npm packages). Set `CHROME=/path/to/browser` if it isn't found.
- No Python today. If Python tooling is added, manage it with **uv** (`uv init`, `uv add`, `uv run`):
  commit `pyproject.toml`, `uv.lock` and `.python-version`; `.venv/` is ignored.

## Development

- Version control: git. `.gitignore` covers OS/editor clutter, `node_modules/`, Python/uv envs and
  caches, `.env*`, `.claude/settings.local.json`, and generated output (`snaps/`, `dist/`).
- `vsm check` writes screenshots to the system temp folder, never into the repo.
- Principles: first principles, DRY, SOLID, KISS — specs are data, the player never knows about
  specific scene types, shared code lives in `core.js`.

## Add a scene type

Create `runtime/types/<type>.js` that calls `VSM.register('<type>', { verbs, state, apply, View })`
(contract documented in `core.js`), document its scene fields and ops in the file header, and add a
`<script>` tag in `player.html`. The player itself never changes.
