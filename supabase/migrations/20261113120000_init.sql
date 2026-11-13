-- Schéma "Projet Canada Calgary" — un dossier par titulaire, lecteurs invités en lecture restreinte.
create extension if not exists "pgcrypto";

create table dossier (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  profile_date date,
  funds_min integer not null default 0,
  funds_target integer not null default 0,
  cad_rate numeric not null default 410,
  created_at timestamptz not null default now()
);
create unique index dossier_owner_unique on dossier(owner_id);

create table collaborator (
  dossier_id uuid not null references dossier(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('titulaire', 'lecteur')),
  invited_at timestamptz not null default now(),
  primary key (dossier_id, user_id)
);

create table identity (
  dossier_id uuid primary key references dossier(id) on delete cascade,
  nom text not null default '',
  prenoms text not null default '',
  naissance date,
  lieu text not null default '',
  pere text not null default '',
  mere text not null default '',
  statut text not null default ''
);

create table profile (
  dossier_id uuid primary key references dossier(id) on delete cascade,
  titre text not null default '',
  enfants text not null default '',
  nationalite text not null default '',
  passeport text not null default '',
  telephone text not null default '',
  courriel text not null default '',
  permis text not null default '',
  adresse text not null default '',
  programme text not null default '',
  cnp text not null default '',
  ville text not null default '',
  repli text not null default ''
);

create table fsw (
  dossier_id uuid primary key references dossier(id) on delete cascade,
  first text not null default 'fr' check (first in ('fr', 'en')),
  fr_co text not null default '',
  fr_ce text not null default '',
  fr_eo text not null default '',
  fr_ee text not null default '',
  en_co text not null default '',
  en_ce text not null default '',
  en_eo text not null default '',
  en_ee text not null default '',
  edu text not null default '',
  arranged text not null default '0' check (arranged in ('0', '10')),
  adapt text not null default '0' check (adapt in ('0', '5', '10'))
);

create table step (
  id text primary key,
  dossier_id uuid not null references dossier(id) on delete cascade,
  phase text not null,
  title text not null,
  due date,
  status text not null default 'À faire' check (status in ('À faire', 'En cours', 'Bloqué', 'Fait', 'Si nécessaire')),
  planned integer,
  actual integer,
  org text not null default '',
  req text not null default '',
  notes text not null default '',
  risk text not null default '',
  position integer not null default 0
);
create index step_dossier_idx on step(dossier_id);

create table step_task (
  id uuid primary key default gen_random_uuid(),
  step_id text not null references step(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  position integer not null default 0
);
create index step_task_step_idx on step_task(step_id);

create table step_link (
  id uuid primary key default gen_random_uuid(),
  step_id text not null references step(id) on delete cascade,
  label text not null,
  url text not null,
  position integer not null default 0
);
create index step_link_step_idx on step_link(step_id);

create table document (
  id text primary key,
  dossier_id uuid not null references dossier(id) on delete cascade,
  name text not null,
  status text not null default 'À obtenir' check (status in ('À obtenir', 'Demandé', 'Obtenu')),
  use_ text not null default '',
  from_org text not null default '',
  date date,
  notes text not null default '',
  req text not null default 'Obligatoire' check (req in ('Obligatoire', 'Conseillé', 'Si applicable')),
  format text not null default '',
  validity text not null default '',
  position integer not null default 0
);
create index document_dossier_idx on document(dossier_id);

create table document_check (
  id uuid primary key default gen_random_uuid(),
  document_id text not null references document(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  position integer not null default 0
);
create index document_check_doc_idx on document_check(document_id);

create table document_link (
  id uuid primary key default gen_random_uuid(),
  document_id text not null references document(id) on delete cascade,
  label text not null,
  url text not null,
  position integer not null default 0
);
create index document_link_doc_idx on document_link(document_id);

create table file (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossier(id) on delete cascade,
  document_id text references document(id) on delete set null,
  storage_path text not null,
  name text not null,
  size integer not null,
  mime text not null,
  uploaded_at timestamptz not null default now()
);
create index file_dossier_idx on file(dossier_id);

create table saving (
  id text primary key,
  dossier_id uuid not null references dossier(id) on delete cascade,
  label text not null,
  planned integer,
  actual integer,
  notes text not null default '',
  position integer not null default 0
);
create index saving_dossier_idx on saving(dossier_id);

create table contact (
  id text primary key,
  dossier_id uuid not null references dossier(id) on delete cascade,
  org text not null default '',
  role text not null default '',
  contact text not null default '',
  person text not null default '',
  next text not null default '',
  notes text not null default '',
  position integer not null default 0
);
create index contact_dossier_idx on contact(dossier_id);

create table gap (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossier(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  position integer not null default 0
);
create index gap_dossier_idx on gap(dossier_id);

create table history (
  id text primary key,
  dossier_id uuid not null references dossier(id) on delete cascade,
  from_date text not null,
  to_date text not null default '',
  type text not null default 'Autre' check (type in ('Travail', 'Études', 'Sans emploi', 'Autre')),
  activity text not null default '',
  org text not null default '',
  place text not null default '',
  parallel boolean not null default false,
  position integer not null default 0
);
create index history_dossier_idx on history(dossier_id);

create table address (
  id text primary key,
  dossier_id uuid not null references dossier(id) on delete cascade,
  from_date text not null,
  to_date text not null default '',
  address text not null default '',
  city text not null default '',
  note text not null default '',
  parallel boolean not null default false,
  position integer not null default 0
);
create index address_dossier_idx on address(dossier_id);

create table reminder_log (
  id uuid primary key default gen_random_uuid(),
  step_id text not null references step(id) on delete cascade,
  kind text not null check (kind in ('J-7', 'J-1')),
  sent_at timestamptz not null default now(),
  unique (step_id, kind)
);

-- ---------- fonctions d'accès (security definer pour éviter la récursion RLS) ----------

create function is_titulaire(d_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from dossier where id = d_id and owner_id = auth.uid());
$$;

create function is_member(d_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from dossier where id = d_id and owner_id = auth.uid())
      or exists(select 1 from collaborator where dossier_id = d_id and user_id = auth.uid());
$$;

create function dossier_of_step(s_id text) returns uuid
language sql security definer stable set search_path = public as $$
  select dossier_id from step where id = s_id;
$$;

create function dossier_of_document(doc_id text) returns uuid
language sql security definer stable set search_path = public as $$
  select dossier_id from document where id = doc_id;
$$;

-- ---------- RLS ----------

alter table dossier enable row level security;
alter table collaborator enable row level security;
alter table identity enable row level security;
alter table profile enable row level security;
alter table fsw enable row level security;
alter table step enable row level security;
alter table step_task enable row level security;
alter table step_link enable row level security;
alter table document enable row level security;
alter table document_check enable row level security;
alter table document_link enable row level security;
alter table file enable row level security;
alter table saving enable row level security;
alter table contact enable row level security;
alter table gap enable row level security;
alter table history enable row level security;
alter table address enable row level security;
alter table reminder_log enable row level security;

create policy dossier_select on dossier for select using (is_member(id));
create policy dossier_insert on dossier for insert with check (owner_id = auth.uid());
create policy dossier_update on dossier for update using (is_titulaire(id));
create policy dossier_delete on dossier for delete using (is_titulaire(id));

create policy collaborator_select on collaborator for select using (is_titulaire(dossier_id) or user_id = auth.uid());
create policy collaborator_write on collaborator for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));

-- identity / profile / fsw / history / address / file : titulaire seul (jamais le lecteur invité)
create policy identity_all on identity for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));
create policy profile_all on profile for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));
create policy fsw_all on fsw for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));
create policy history_all on history for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));
create policy address_all on address for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));
create policy file_all on file for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));
create policy gap_all on gap for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));

-- step / document / saving / contact : lecture pour les membres (lecteur inclus), écriture titulaire seul
create policy step_select on step for select using (is_member(dossier_id));
create policy step_write on step for insert with check (is_titulaire(dossier_id));
create policy step_update on step for update using (is_titulaire(dossier_id));
create policy step_delete on step for delete using (is_titulaire(dossier_id));

create policy step_task_select on step_task for select using (is_member(dossier_of_step(step_id)));
create policy step_task_write on step_task for all using (is_titulaire(dossier_of_step(step_id))) with check (is_titulaire(dossier_of_step(step_id)));

create policy step_link_select on step_link for select using (is_member(dossier_of_step(step_id)));
create policy step_link_write on step_link for all using (is_titulaire(dossier_of_step(step_id))) with check (is_titulaire(dossier_of_step(step_id)));

create policy document_select on document for select using (is_member(dossier_id));
create policy document_write on document for insert with check (is_titulaire(dossier_id));
create policy document_update on document for update using (is_titulaire(dossier_id));
create policy document_delete on document for delete using (is_titulaire(dossier_id));

create policy document_check_select on document_check for select using (is_member(dossier_of_document(document_id)));
create policy document_check_write on document_check for all using (is_titulaire(dossier_of_document(document_id))) with check (is_titulaire(dossier_of_document(document_id)));

create policy document_link_select on document_link for select using (is_member(dossier_of_document(document_id)));
create policy document_link_write on document_link for all using (is_titulaire(dossier_of_document(document_id))) with check (is_titulaire(dossier_of_document(document_id)));

create policy saving_select on saving for select using (is_member(dossier_id));
create policy saving_write on saving for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));

create policy contact_select on contact for select using (is_member(dossier_id));
create policy contact_write on contact for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));

-- reminder_log : aucune policy -> accessible seulement via la clé service (cron), bloqué pour anon/authenticated.

-- ---------- vue budget par phase ----------

create view budget_par_phase with (security_invoker = true) as
  select dossier_id, phase, sum(coalesce(planned, 0)) as planned, sum(coalesce(actual, 0)) as actual
  from step
  group by dossier_id, phase;

-- ---------- stockage : coffre privé ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coffre', 'coffre', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy coffre_select on storage.objects for select
  using (bucket_id = 'coffre' and is_titulaire((storage.foldername(name))[1]::uuid));
create policy coffre_insert on storage.objects for insert
  with check (bucket_id = 'coffre' and is_titulaire((storage.foldername(name))[1]::uuid));
create policy coffre_update on storage.objects for update
  using (bucket_id = 'coffre' and is_titulaire((storage.foldername(name))[1]::uuid));
create policy coffre_delete on storage.objects for delete
  using (bucket_id = 'coffre' and is_titulaire((storage.foldername(name))[1]::uuid));
