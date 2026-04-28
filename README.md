# firth-cli

> The runtime CLI for [Firth](https://github.com/firthdev/firth) — the cloud platform SDK for AI coding agents.

**Status:** Pre-alpha. v0.0.1 ships only `firth init` (project scaffolding).

This repo is the **L2 / CLI layer** of the Firth project. The companion repo [`firth`](https://github.com/firthdev/firth) holds the L1 / Knowledge layer (Skills, templates, runbooks, ARCHITECTURE.md).

For the project's overall design and rationale, see [`firth/ARCHITECTURE.md`](https://github.com/firthdev/firth/blob/main/ARCHITECTURE.md). This README is just for the CLI itself.

## Local development

```bash
# from this directory
npm install

# run the CLI in dev (no build step)
npm run dev -- init

# typecheck
npm run typecheck

# tests
npm test

# build a distributable
npm run build

# link into your shell so `firth` works globally during dev
npm link
firth init my-test-app
```

## Commands (current)

### `firth init [name]`

Scaffold a Firth project. Generates `firth.config.ts` and `firth.lock.json`.

```bash
# interactive
firth init my-app

# in current directory
firth init .

# non-interactive (agent-friendly): use defaults
firth init my-app --yes

# non-interactive with explicit overrides
firth init my-app --frontend=nextjs --backend=hono --db=neon \
  --frontend-host=vercel --backend-host=railway --yes
```

Defaults (when `--yes` is passed): Next.js + Hono + Neon Postgres + Vercel + Railway.

## Commands (planned)

- `firth deploy` — provision resources and push code across the stack.
- `firth secrets set/get/list` — sync secrets across providers.
- `firth logs [--service]` — tail logs.
- `firth status` — current deployment + resource state.
- `firth handoff` — generate a context dump for a fresh agent session.
- `firth db migrate / db reset` — database lifecycle.

## Design notes

- **Thin orchestrator, not a wrapper.** Every command shells out to the official provider CLI/API; we never re-implement provider features.
- **Agent-friendly errors.** Failures emit `ERROR / LIKELY CAUSE / SUGGESTED ACTIONS` so an agent loop can recover.
- **Local state lives in the project.** `firth.config.ts` (declarative, hand-edited) + `firth.lock.json` (generated, holds resource IDs) — both committed.

See [`firth/ARCHITECTURE.md`](https://github.com/firthdev/firth/blob/main/ARCHITECTURE.md) for the full rationale.

## License

MIT (planned).
