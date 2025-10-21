# Database Schema – MathsMine3

This directory contains the SQL logic behind the MathsMine3 backend.

All schema definitions are written for **PostgreSQL** and deployed using **Supabase**.

---

## Tables

### `games`
Stores individual math round results, including reward and accuracy.

```sql
CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  problem TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_ms INTEGER NOT NULL,
  mining_reward NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `api_requests`
Used for rate limiting. One row per request.

```sql
CREATE TABLE api_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Views

### `leaderboard`
ETH contribution per wallet (correct answers only).

```sql
CREATE VIEW leaderboard AS
SELECT
  wallet,
  SUM(mining_reward) AS total_eth
FROM games
WHERE is_correct = TRUE
GROUP BY wallet;
```

### `token_value`
Total ETH mined (cumulative).

```sql
CREATE VIEW token_value AS
SELECT
  SUM(mining_reward) AS total_eth
FROM games
WHERE is_correct = TRUE;
```

### `token_value_timeseries`
Hourly reward time series (for charts).

```sql
CREATE OR REPLACE VIEW token_value_timeseries AS
WITH hour_series AS (
  SELECT generate_series(
    date_trunc('hour', (SELECT MIN(created_at) FROM games)),
    date_trunc('hour', NOW()),
    interval '1 hour'
  ) AS hour
),
hour_rewards AS (
  SELECT
    date_trunc('hour', created_at) AS hour,
    SUM(mining_reward) AS total_hour
  FROM games
  WHERE is_correct = TRUE
  GROUP BY date_trunc('hour', created_at)
),
final AS (
  SELECT
    hs.hour,
    COALESCE(hr.total_hour, 0) AS hourly_reward
  FROM hour_series hs
  LEFT JOIN hour_rewards hr ON hr.hour = hs.hour
)
SELECT
  hour,
  SUM(hourly_reward) OVER (ORDER BY hour) AS cumulative_reward
FROM final;
```

---

## Notes

- All views are read-only and update automatically from `games`.
- Used by charts, leaderboard, token logic and API endpoints.