# infra/

Deployment and local-dev infrastructure.

- `docker-compose.yml` — local Redis (and helpers) for development (Phase 6)
- `railway/` — Railway service config + Dockerfiles for api / worker / web (Phase 7)
- `cloudflare/` — Pages/Wrangler config for the landing site (Phase 7)

## Local stack

Run these from the repo root — they wrap `docker compose -f infra/docker-compose.yml`
so you never have to pass `-f` by hand:

| Command | What it does |
| --- | --- |
| `pnpm infra:up` | Build + start redis, reel-renderer, worker (detached) |
| `pnpm infra:redis` | Queue only — for when you run the worker on the host |
| `pnpm infra:logs` | Follow logs for all services (`pnpm infra:logs worker` for one) |
| `pnpm infra:ps` | Container + health status |
| `pnpm infra:restart` | Restart just the worker (picks up `.env` changes) |
| `pnpm infra:down` | Stop everything, keep the redis volume |
| `pnpm infra:reset` | Stop everything + drop the redis volume and orphan containers |

`api` and `web` stay on the host for hot-reload. The worker reads secrets from the
repo-root `.env`, so after editing it run `pnpm infra:restart` — compose does not
re-read `env_file` on its own.
