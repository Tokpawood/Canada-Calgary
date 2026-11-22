-- Aide-mémoire de la formation : leçons de synthèse (texte Markdown collé depuis un correcteur).
create table training_memo (
  id text primary key,
  dossier_id uuid not null references dossier(id) on delete cascade,
  exam text not null check (exam in ('tcf', 'ielts')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 60000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index training_memo_dossier_idx on training_memo(dossier_id);

alter table training_memo enable row level security;
create policy training_memo_select on training_memo for select using (is_member(dossier_id));
create policy training_memo_write on training_memo for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));
