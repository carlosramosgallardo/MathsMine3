# SQL in this repo

Live Postgres is the Supabase project `udarguklgjjlfnlsqdfw` (eu-west-2). GitHub must not carry SECURITY DEFINER function bodies, view formulas, bot-wallet ops scripts, or destructive resets.

| Location | What it is |
|---|---|
| `supabase/migrations/` | **Authoritative history** — add a new migration for every live schema change |
| `sql/live-inventory.sql` | Public structural photo of live `public` (tables, constraints, indexes, RLS, GRANTs, RPC **signatures only**) |
| `.private/sql/schema.sql` | Full live dump including function bodies and views. **Gitignored. Never commit.** |
| `.private/sql/ops/` | Manual QA / reset scripts (bot wallets, chain reset). **Gitignored. Never commit.** |
| `tools/sql/farming_snapshot.sql` | Read-only SELECT for farming audit (does **not** replace `tools/balance/farming.py`) |

`sql/database.sql`, `supabase/database.sql`, `sql/rl_mount.sql`, and `sql/test_*.sql` were removed because they had drifted from production (wrong boss RPC arity, missing `relaying` on `mm3_mining_events`, leftover `mm3_game_winner`) and/or leaked ops SQL.

When you change the database: write a migration under `supabase/migrations/`, apply it to Supabase, then refresh `.private/sql/schema.sql` and `sql/live-inventory.sql` from the live catalog. Do not treat any dump as a bootstrap to run on production.
