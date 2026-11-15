-- Notifications push : abonnements des appareils, réglages des horaires, journal des envois.

create table push_subscription (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossier(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index push_subscription_dossier_idx on push_subscription(dossier_id);

alter table push_subscription enable row level security;
create policy push_subscription_own on push_subscription for all
  using (user_id = auth.uid() and is_titulaire(dossier_id))
  with check (user_id = auth.uid() and is_titulaire(dossier_id));

-- Horaires des rappels (HH:MM, heure d'Abidjan) par moment de la journée.
create table notification_settings (
  dossier_id uuid primary key references dossier(id) on delete cascade,
  enabled boolean not null default true,
  times jsonb not null default '{}'::jsonb,
  include_steps boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table notification_settings enable row level security;
create policy notification_settings_select on notification_settings for select using (is_member(dossier_id));
create policy notification_settings_write on notification_settings for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));

-- Un rappel donné n'est envoyé qu'une fois (clé « AAAA-MM-JJ:moment »). Accès réservé au serveur.
create table notification_log (
  dossier_id uuid not null references dossier(id) on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (dossier_id, key)
);
alter table notification_log enable row level security;

-- Planificateur : appelle l'envoi des rappels toutes les 5 minutes (tâche créée à part, avec l'adresse et le secret).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
