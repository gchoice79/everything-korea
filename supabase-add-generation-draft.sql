alter table articles
  add column if not exists draft jsonb;
