# SQL reference files

**Do not treat files in this folder as the live schema source of truth.**

| Location | Purpose |
|---|---|
| `supabase/migrations/` | **Authoritative** — apply in order for prod/staging |
| `supabase/database.sql` | Stale dump (see header warning); regenerate with `supabase db dump --schema public` if needed |
| `sql/database.sql` | Legacy bootstrap reference |
| `sql/test_*.sql` | Manual QA / maintenance scripts |
| `tools/sql/farming_snapshot.sql` | Read-only SELECT for farming audit (does **not** replace `tools/balance/farming.py`) |

When changing the database, add a migration under `supabase/migrations/` and deploy via Supabase CLI or dashboard — never hand-edit `supabase/database.sql` alone.
