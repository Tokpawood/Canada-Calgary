-- Consommation estimée de l'API Claude, appel par appel.
create table ai_usage (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossier(id) on delete cascade,
  day date not null,
  task text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  searches integer not null default 0,
  cost_usd numeric(10,5) not null default 0,
  created_at timestamptz not null default now()
);
create index ai_usage_dossier_day_idx on ai_usage(dossier_id, day);

alter table ai_usage enable row level security;
create policy ai_usage_select on ai_usage for select using (is_titulaire(dossier_id));
create policy ai_usage_insert on ai_usage for insert with check (is_titulaire(dossier_id));
