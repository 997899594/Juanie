# CLAUDE.md

`AGENTS.md` is the canonical agent instruction file for this repository. Keep this file thin so it
does not become a second, stale architecture source.

## Commands

```bash
bun run dev
bun run dev:web
bun run dev:worker
bun run dev:scheduler
bun run lint
bun run typecheck
bun run test
bun run build
bun run ai:eval
bun run db:generate <name>
bun run db:hash
bun run db:validate
bun run db:push
```

## Current Architecture

- Next.js App Router provides the UI and API surface.
- BullMQ + Redis powers project init, release, deployment, migration, schema repair, and AI task
  workers.
- Drizzle is the control-plane schema authoring layer.
- Atlas is the only active control-plane migration executor.
- Platform self-deploy uses CI-built `web` and shared `runtime` images, a GitOps values pointer,
  Argo CD, Helm, and a PreSync schema-runner Job.
- User applications are released through Juanie's release state machine, not through platform
  self-deploy.
- Preview scaffold is managed through Argo CD ApplicationSet.
- Production rollout uses Argo Rollouts where the environment strategy requires it.

## Editing Rules

- Prefer `AGENTS.md` and `docs/current-architecture.md` when architecture details conflict.
- Do not restore SSH Helm deploy scripts.
- Do not restore the retired root `docker-bake.hcl` for platform images.
- Do not treat historical `docs/plans/` files as implementation truth.
- Keep `migrations/` as the active Atlas migration directory.
