create table if not exists site_visits (
  id bigserial primary key,
  created_at timestamptz not null default now()
);

alter table site_visits enable row level security;
