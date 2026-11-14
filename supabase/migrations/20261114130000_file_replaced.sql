-- Remplacement d'un fichier : un nouveau dépôt avec le même nom sur la même pièce remplace l'ancien.
-- L'ancien est conservé (dossier Drive « Fichiers remplacés ») et marqué ici.
alter table file add column replaced_at timestamptz;
alter table file add column replaced_by uuid references file(id) on delete set null;
create index file_active_name_idx on file (dossier_id, document_id, lower(name)) where replaced_at is null;
