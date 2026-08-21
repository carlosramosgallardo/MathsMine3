# SQL reference files

**Do not treat files in this folder as the live schema source of truth.**

| Location | Purpose |
|---|---|
| `supabase/migrations/` | **Authoritative** — apply in order for prod/staging |
| `supabase/database.sql` | Stale dump (see header warning); regenerate with `supabase db dump --schema public` if needed |
| `sql/database.sql` | Legacy bootstrap reference |
| `sql/test_*.sql` | Manual QA / maintenance scripts |

When changing the database, add a migration under `supabase/migrations/` and deploy via Supabase CLI or dashboard — never hand-edit `supabase/database.sql` alone.
