-- Synchronisation vers Google Calendar : calendrier créé par l'application et événements déjà envoyés.
-- Aucune politique RLS : lecture et écriture par la clé de service uniquement (comme drive_connection).
create table calendar_sync (
  dossier_id uuid primary key references dossier(id) on delete cascade,
  enabled boolean not null default false,
  calendar_id text,
  -- clé d'événement → « date|empreinte »
  sent jsonb not null default '{}'::jsonb,
  pending integer not null default 0,
  running boolean not null default false,
  locked_at timestamptz,
  last_sync timestamptz,
  last_error text
);
alter table calendar_sync enable row level security;
