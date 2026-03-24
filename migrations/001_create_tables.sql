create table price_history (
  id uuid primary key default gen_random_uuid(),
  symbol text,
  price numeric,
  bid numeric,
  ask numeric,
  volume numeric,
  created_at timestamp default now()
);

create table signals (
  id uuid primary key default gen_random_uuid(),
  symbol text,
  signal_type text,
  velocity numeric,
  acceleration numeric,
  spread numeric,
  divergence numeric,
  created_at timestamp default now()
);