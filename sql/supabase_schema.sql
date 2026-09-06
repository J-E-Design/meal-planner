-- Meal planner schema for Supabase (Postgres).
-- Run this once in the Supabase SQL Editor.

create table if not exists app_state (
  name text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_state enable row level security;

-- Single shared list, no accounts: allow the public "anon" key full access.
create policy "allow anon full access" on app_state
  for all
  using (true)
  with check (true);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists app_state_updated_at on app_state;
create trigger app_state_updated_at
before update on app_state
for each row execute function set_updated_at();

insert into app_state (name, value) values
  ('meals', '[]'::jsonb),
  ('week', '[null,null,null,null,null,null,null]'::jsonb)
on conflict (name) do nothing;
