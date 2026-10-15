# Shared database migration history

The shared Supabase database uses this migration sequence:

1. `20261002003434_init`
2. `20261006003730_add_entitlement_and_usage_record`
3. `20261015000000_add_learning_history_and_reviews`

The schema combines subscription and usage tracking with learning history.
`User` retains its usage window, entitlement, and usage-record relations, and
owns explanations. Knowledge gaps and review data inherit ownership through
the explanation relation.

## Recovery of the combined migration

The October 6 migration was applied to Supabase but was missing from Git.
Its SQL was reconstructed with Prisma's schema-to-schema diff, from the
original `User` schema to the subscription/usage schema on `origin/kazi`.
The resulting file's SHA-256 checksum exactly matched the successful migration
record in Supabase's `_prisma_migrations` table:

```text
5b0ecbc3b3fcc4e6d2cd4b43ea573f6571fb0dc2f9e05d2a51fc9f309cd899e3
```

The restored SQL is therefore verified against the already-applied migration;
the database's migration records do not need to be rewritten or marked resolved.
Keep this file unchanged, including its formatting and line endings.

## Kazi's older branch history

The `origin/kazi` branch at `3e7aa99` instead contains these earlier migrations:

- `20261005030125_add_entitlement`
- `20261005033320_add_usage_record`
- `20261005070828_delete_active_from_entitlement`

Those files are a different migration lineage. They are not pending migrations
for the shared Supabase database. Do not deploy that branch's migration directory
to the shared database or blindly combine both histories during a future merge:
Prisma would try to create existing tables. The canonical directory above already
includes the final entitlement/usage schema. A separate database that actually
applied the three older migrations needs its own history reconciliation before
using the canonical directory.

## Checking and applying migrations

Run commands from `apps/backend`, where `prisma7.config.ts` loads `.env`:

```bash
bunx --bun prisma validate --config prisma7.config.ts
bunx --bun prisma migrate status --config prisma7.config.ts
bunx --bun prisma migrate diff --config prisma7.config.ts \
  --from-config-datasource --to-schema prisma/schema.prisma --script
```

Compare the reported pending migrations and SQL with the committed files before
applying. For the shared database, use the reviewed migration files:

```bash
bunx --bun prisma migrate deploy --config prisma7.config.ts
bunx --bun prisma generate --config prisma7.config.ts
```

After deployment, `migrate status` should report that the database is up to date,
and `migrate diff --from-config-datasource --to-schema prisma/schema.prisma
--exit-code --config prisma7.config.ts` should report no difference.

Do not reset the shared database or edit its migration ledger to bypass a
missing-file or checksum mismatch. Recover and verify the original migration
content first.
