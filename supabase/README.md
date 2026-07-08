# supabase/

Supabase is the **provider** (Postgres + Auth + Realtime + Storage-not-used-for-media). The database
**schema is managed by Prisma** in [`packages/db`](../packages/db) — not by the Supabase CLI.

- Tables/enums/relations → `packages/db/prisma/schema.prisma`
- Auth-schema FKs, `updated_at` + new-user triggers, RLS policies, Realtime publication →
  `packages/db/prisma/migrations/*_supabase_rls_triggers/migration.sql`
- Seed (voice catalog) → `packages/db/prisma/seed.ts`

## Apply schema + seed (hosted project)

Set `SUPABASE_DB_URL` in `.env` to the Postgres URI (Dashboard → Database → Connection string → URI,
port 5432 / session — includes the DB password), then:

```bash
pnpm --filter @sentezy/db exec prisma migrate deploy   # applies both migrations
pnpm --filter @sentezy/db run seed                      # seeds the voice catalog
```

Prisma Client is the DB layer for the TypeScript side (API, and web if needed); the Python worker
talks to Postgres directly.
