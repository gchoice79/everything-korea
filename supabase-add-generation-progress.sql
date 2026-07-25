alter table articles
  add column if not exists progress_phase text,
  add column if not exists progress_current integer,
  add column if not exists progress_total integer,
  add column if not exists error text;
