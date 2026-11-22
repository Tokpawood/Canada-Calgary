-- Tests TCF Canada en conditions réelles, préparés par Claude à partir de documents trouvés sur internet.
-- Un test par jour (rotation des épreuves) et un test de positionnement au départ.
-- Chaque test est fait de sections (CO, CE, EE, EO) ; le contenu de chaque section est préparé
-- en plusieurs morceaux (tcf_test_part) générés en parallèle.
create table tcf_test (
  id text primary key,
  dossier_id uuid not null references dossier(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('positionnement', 'quotidien', 'blanc')),
  title text not null default '',
  -- Sections prévues : [{ epreuve, count, minutes, levels[], tasks[] }]
  plan jsonb not null,
  -- Notes de recherche (documents authentiques trouvés sur le web) et sources consultées.
  research text not null default '',
  sources jsonb not null default '[]',
  -- Par section : { started_at, submitted_at, answers, result }
  progress jsonb not null default '{}',
  -- Bilan global et niveaux estimés par épreuve une fois toutes les sections rendues.
  summary jsonb,
  status text not null default 'pret' check (status in ('pret', 'corrige')),
  model text not null default '',
  created_at timestamptz not null default now(),
  corrected_at timestamptz,
  unique (dossier_id, day, kind)
);
create index tcf_test_dossier_idx on tcf_test(dossier_id, day desc);

create table tcf_test_part (
  test_id text not null references tcf_test(id) on delete cascade,
  idx integer not null check (idx between 0 and 40),
  dossier_id uuid not null references dossier(id) on delete cascade,
  status text not null default 'en_cours' check (status in ('en_cours', 'pret', 'erreur')),
  content jsonb,
  error text,
  updated_at timestamptz not null default now(),
  primary key (test_id, idx)
);

alter table tcf_test enable row level security;
create policy tcf_test_select on tcf_test for select using (is_member(dossier_id));
create policy tcf_test_write on tcf_test for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));

alter table tcf_test_part enable row level security;
create policy tcf_test_part_select on tcf_test_part for select using (is_member(dossier_id));
create policy tcf_test_part_write on tcf_test_part for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));
