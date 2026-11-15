-- Dossiers du Coffre (« Bulletins », « Reçus de loyer »…) : classement libre des fichiers.
-- Chaque dossier a son sous-dossier Google Drive, créé au premier dépôt.
create table vault_folder (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossier(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create unique index vault_folder_name_idx on vault_folder (dossier_id, lower(btrim(name)));

alter table vault_folder enable row level security;
create policy vault_folder_all on vault_folder for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));

alter table file add column folder_id uuid references vault_folder(id) on delete set null;
create index file_folder_idx on file (folder_id);
