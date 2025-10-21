
create table if not exists polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  wallet_address text not null,
  created_at timestamp with time zone default now(),
  active boolean default true
);

create table if not exists poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid references polls(id) on delete cascade,
  wallet_address text not null,
  vote text check (vote in ('yes', 'no')),
  voted_at timestamp with time zone default now(),
  unique (poll_id, wallet_address)
);
