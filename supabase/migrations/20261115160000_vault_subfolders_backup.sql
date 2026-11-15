-- 1. Sous-dossiers du Coffre : un dossier peut contenir d'autres dossiers (ex. Bulletins › 2023).
--    Un dossier ne se supprime que vide (ni fichier, ni sous-dossier).
alter table vault_folder add column parent_id uuid references vault_folder(id) on delete restrict;
create index vault_folder_parent_idx on vault_folder (parent_id);
alter table vault_folder add constraint vault_folder_not_self check (parent_id is null or parent_id <> id);

-- Nom unique parmi les dossiers d'un même parent.
drop index vault_folder_name_idx;
create unique index vault_folder_name_idx on vault_folder (dossier_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));

-- 2. Fichiers stockés d'abord dans l'application (stockage « coffre »), puis copiés sur Google Drive
--    en sauvegarde. drive_file_id désigne alors la copie de sauvegarde.
alter table file add column drive_backup_at timestamptz;
alter table file add column drive_backup_error text;
create index file_backup_pending_idx on file (dossier_id) where provider = 'supabase' and drive_file_id is null and replaced_at is null;
