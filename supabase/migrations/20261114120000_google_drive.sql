-- Stockage des fichiers sur Google Drive.
-- Un fichier vit soit dans le bucket Supabase « coffre » (historique), soit sur Google Drive.
alter table file add column provider text not null default 'supabase' check (provider in ('supabase', 'gdrive'));
alter table file add column drive_file_id text;
alter table file alter column storage_path drop not null;
alter table file add constraint file_location_chk check (
  (provider = 'supabase' and storage_path is not null) or (provider = 'gdrive' and drive_file_id is not null)
);

-- Connexion Google Drive du titulaire. Le jeton de rafraîchissement est chiffré (AES-256-GCM) côté serveur.
-- Aucune politique RLS : la table n'est lisible et modifiable qu'avec la clé de service (routes serveur).
create table drive_connection (
  dossier_id uuid primary key references dossier(id) on delete cascade,
  refresh_token_enc text,
  account_email text,
  root_folder_id text,
  folders jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table drive_connection enable row level security;
