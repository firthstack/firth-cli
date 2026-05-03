# firth-cli

> The runtime CLI for [Firth](https://github.com/firthstack/firth) — the cloud platform SDK for AI coding agents.

**Status:** Pre-alpha. v0.0.1 ships only `firth init` (project scaffolding).

This repo is the **L2 / CLI layer** of the Firth project. The companion repo [`firth`](https://github.com/firthstack/firth) holds the L1 / Knowledge layer (Skills, templates, runbooks, ARCHITECTURE.md).

For the project's overall design and rationale, see [`firth/ARCHITECTURE.md`](https://github.com/firthstack/firth/blob/main/ARCHITECTURE.md). This README is just for the CLI itself.

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

# scaffold only — skip skill + CLI installs (for offline / CI)
firth init my-app --yes --skip-install
```

Defaults (when `--yes` is passed): Next.js + Hono + Neon Postgres + Vercel + Railway.

### Skills + CLIs installed for you

After writing `firth.config.ts` / `firth.lock.json`, `firth init` shells out to install
the host-specific agent skills and CLIs implied by your stack. These let your
coding agent (Claude Code, etc.) work the deploy targets natively.

If `frontendHost = vercel`:

```
npx skills add vercel-labs/next-skills --skill next-best-practices \
  --skill next-cache-components --skill next-upgrade
npx skills add vercel/vercel --skill vercel-cli
npx skills add vercel-labs/agent-skills --skill vercel-deploy
npx skills add vercel-labs/autoship --skill autoship
npm i -g vercel
```

If `backendHost = railway`:

```
npx skills add railwayapp/railway-skills
npm i -g @railway/cli
```

In interactive mode you'll be asked to confirm before any of these run. With
`--yes` they run automatically. Pass `--skip-install` to suppress them entirely;
the commands are still printed in the next-steps so you can run them by hand.
`npm i -g …` may need `sudo` on system Node installs — failures are surfaced
but do not abort `firth init`.

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
