create table if not exists ai_usage_log (
  id bigserial primary key,
  provider text not null check (provider in ('anthropic')),
  purpose text not null,
  tokens_in integer,
  tokens_out integer,
  model text,
  created_at timestamptz not null default now()
);

alter table ai_usage_log enable row level security;
