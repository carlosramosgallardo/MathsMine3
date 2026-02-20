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

CREATE TABLE nft_catalog (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  condition TEXT, 
  rarity TEXT DEFAULT 'common'
    CHECK (rarity IN ('common', 'rare', 'epic', 'legendary'))
);

CREATE OR REPLACE VIEW computed_user_nfts AS
WITH ranked AS (
  SELECT
    LOWER(wallet) AS wallet,
    total_eth,
    RANK() OVER (ORDER BY total_eth DESC) AS rank
  FROM leaderboard
),
unique_top1 AS (
  SELECT wallet
  FROM ranked
  WHERE rank = 1
),
tie_check AS (
  SELECT COUNT(*) = 1 AS is_unique_top FROM ranked WHERE rank = 1
),
top_wallet_nft AS (
  SELECT
    LOWER(w.wallet) AS wallet,
    'pi_constant' AS nft_slug
  FROM unique_top1 w, tie_check t
  WHERE t.is_unique_top
)

SELECT
  nft.wallet,
  nft.nft_slug,
  c.image_url,
  c.name,
  c.description,
  c.rarity
FROM top_wallet_nft nft
JOIN nft_catalog c ON c.slug = nft.nft_slug;


CREATE OR REPLACE VIEW leaderboard_with_nfts AS
SELECT
  l.wallet,
  l.total_eth,
  COALESCE(
    json_agg(json_build_object(
      'slug', u.nft_slug,
      'image_url', u.image_url,
      'name', u.name,
      'description', u.description,
      'rarity', u.rarity
    ) ORDER BY u.nft_slug)
    FILTER (WHERE u.nft_slug IS NOT NULL),
    '[]'
  ) AS nfts
FROM leaderboard l
LEFT JOIN computed_user_nfts u ON LOWER(u.wallet) = l.wallet
GROUP BY l.wallet, l.total_eth;



CREATE OR REPLACE VIEW token_value AS
SELECT
  SUM(mining_reward) AS total_eth
FROM games
WHERE is_correct = TRUE;


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
  SUM(hourly_reward) OVER (
    ORDER BY hour ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS cumulative_reward
FROM final;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE api_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE OR REPLACE VIEW api_rate_summary AS
SELECT
  ip,
  endpoint,
  COUNT(*) AS total_requests,
  MAX(created_at) AS last_request
FROM api_requests
GROUP BY ip, endpoint;

create table if not exists mm3_visual_state (
  id smallint primary key default 1 check (id = 1),
  color_hex text not null default '#000000',     
  updated_at timestamptz not null default now()
);

insert into mm3_visual_state (id, color_hex)
values (1, '#000000')
on conflict (id) do nothing;

alter table mm3_visual_state enable row level security;

create policy "public_read_visual_state"
on mm3_visual_state for select
to public
using (true);

create table if not exists mm3_donations (
  id bigserial primary key,
  wallet text not null,
  amount_eth numeric not null check (amount_eth > 0),
  created_at timestamptz not null default now()
);

alter table mm3_donations enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'mm3_donations'
      and policyname = 'public_read_mm3_donations'
  ) then
    create policy "public_read_mm3_donations"
      on mm3_donations for select
      to public
      using (true);
  end if;
end $$;

create or replace view donation_total as
select coalesce(sum(amount_eth), 0) as total_eth
from mm3_donations;
