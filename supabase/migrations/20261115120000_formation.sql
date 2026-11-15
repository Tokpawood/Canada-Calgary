-- Formation TCF Canada / IELTS : tâches cochées et scores des tests.

-- Une ligne = une tâche faite. La clé identifie la tâche dans le programme
-- (ex. « 2026-11-16:am » pour un créneau du jour, « s1:e0 » pour un envoi de la semaine 1).
create table training_check (
  dossier_id uuid not null references dossier(id) on delete cascade,
  item_key text not null check (char_length(item_key) between 1 and 80),
  done_at timestamptz not null default now(),
  primary key (dossier_id, item_key)
);

create table training_score (
  id text primary key,
  dossier_id uuid not null references dossier(id) on delete cascade,
  exam text not null check (exam in ('tcf', 'ielts')),
  label text not null default '',
  taken_on date,
  -- TCF : CO, CE (/699), EE, EO (/20). IELTS : Listening, Reading, Writing, Speaking (bandes 0 à 9).
  s1 numeric(5, 1),
  s2 numeric(5, 1),
  s3 numeric(5, 1),
  s4 numeric(5, 1),
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index training_score_dossier_idx on training_score(dossier_id);

alter table training_check enable row level security;
alter table training_score enable row level security;

create policy training_check_select on training_check for select using (is_member(dossier_id));
create policy training_check_write on training_check for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));
create policy training_score_select on training_score for select using (is_member(dossier_id));
create policy training_score_write on training_score for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));
