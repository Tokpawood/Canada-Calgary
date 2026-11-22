-- Exercices du jour générés par Claude à partir du carnet d'erreurs, de l'aide-mémoire et du programme.
-- Une série par jour et par examen ; les réponses attendues restent côté serveur jusqu'à la correction.
create table training_quiz (
  id text primary key,
  dossier_id uuid not null references dossier(id) on delete cascade,
  day date not null,
  exam text not null check (exam in ('tcf', 'ielts')),
  title text not null default '',
  focus text not null default '',
  items jsonb not null,
  answers jsonb,
  results jsonb,
  score numeric(5, 2),
  total integer not null check (total between 1 and 30),
  status text not null default 'pret' check (status in ('pret', 'corrige')),
  model text not null default '',
  created_at timestamptz not null default now(),
  corrected_at timestamptz,
  unique (dossier_id, day, exam)
);
create index training_quiz_dossier_idx on training_quiz(dossier_id, day desc);

alter table training_quiz enable row level security;
create policy training_quiz_select on training_quiz for select using (is_member(dossier_id));
create policy training_quiz_write on training_quiz for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));
