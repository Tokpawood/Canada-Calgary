-- Carnet d'erreurs de la formation : phrase fautive, correction, règle, nombre de répétitions.
create table training_error (
  id text primary key,
  dossier_id uuid not null references dossier(id) on delete cascade,
  exam text not null check (exam in ('tcf', 'ielts')),
  skill text not null default '',
  wrong text not null check (char_length(wrong) between 1 and 2000),
  correct text not null default '' check (char_length(correct) <= 2000),
  rule text not null default '' check (char_length(rule) <= 2000),
  count integer not null default 1 check (count between 1 and 999),
  mastered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index training_error_dossier_idx on training_error(dossier_id);

alter table training_error enable row level security;
create policy training_error_select on training_error for select using (is_member(dossier_id));
create policy training_error_write on training_error for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));
