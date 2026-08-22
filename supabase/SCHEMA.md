# Supabase schema

Incremental history for production lives in [`migrations/`](migrations/).

The full live dump (function bodies, view SQL) is local-only: `.private/sql/schema.sql` (gitignored). The GitHub-safe structural photo is [`sql/live-inventory.sql`](../sql/live-inventory.sql).

`database.sql` was removed; it had drifted from live (for example `apply_mm3_boss_attack_player` is 8 arguments including `p_storm_active`, and `mm3_mining_events` allows `relaying`).
