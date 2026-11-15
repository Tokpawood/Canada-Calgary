-- Personnes indépendantes (sans organisme), fiches d'identification complètes et photos (organismes et personnes).

-- 1. Personnes : rattachées au dossier, l'organisme devient facultatif.
alter table contact_person add column dossier_id uuid references dossier(id) on delete cascade;
update contact_person p set dossier_id = c.dossier_id from contact c where c.id = p.contact_id;
alter table contact_person alter column dossier_id set not null;
alter table contact_person alter column contact_id drop not null;
create index contact_person_dossier_idx on contact_person(dossier_id);

alter table contact_person
  add column photo_path text,
  add column relation text not null default '',
  add column whatsapp text not null default '',
  add column website text not null default '',
  add column address text not null default '',
  add column city text not null default '',
  add column country text not null default '',
  add column birth_date date,
  add column nationality text not null default '',
  add column id_type text not null default '',
  add column id_number text not null default '';

alter table contact add column photo_path text;

-- Le dossier suit l'organisme ; le responsable appartient au même organisme (ou est lui aussi indépendant) et au même dossier.
create or replace function contact_person_same_org() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.contact_id is not null then
    new.dossier_id := dossier_of_contact(new.contact_id);
  end if;
  if new.parent_id is not null and not exists (
    select 1 from contact_person p where p.id = new.parent_id and p.contact_id is not distinct from new.contact_id and p.dossier_id = new.dossier_id
  ) then
    raise exception 'Le responsable doit appartenir au même organisme.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger contact_person_same_org on contact_person;
create trigger contact_person_same_org before insert or update of parent_id, contact_id, dossier_id on contact_person
  for each row execute function contact_person_same_org();

drop policy contact_person_select on contact_person;
drop policy contact_person_write on contact_person;
create policy contact_person_select on contact_person for select using (is_member(dossier_id));
create policy contact_person_write on contact_person for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));

create or replace function contact_person_from_legacy() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if btrim(coalesce(new.person, '')) <> '' then
    insert into contact_person (contact_id, dossier_id, name) values (new.id, new.dossier_id, left(btrim(new.person), 120));
    update contact set person = '' where id = new.id;
  end if;
  return null;
end;
$$;

-- 2. Liens étapes : vers un organisme, une personne de l'organisme, ou une personne indépendante.
alter table contact_step add column dossier_id uuid references dossier(id) on delete cascade;
update contact_step l set dossier_id = s.dossier_id from step s where s.id = l.step_id;
alter table contact_step alter column dossier_id set not null;
alter table contact_step alter column contact_id drop not null;
alter table contact_step add constraint contact_step_target check (contact_id is not null or person_id is not null);
drop index contact_step_unique;
create unique index contact_step_unique on contact_step(step_id, coalesce(contact_id, ''), coalesce(person_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index contact_step_dossier_idx on contact_step(dossier_id);
create index contact_step_person_idx on contact_step(person_id);

create or replace function contact_step_consistent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.dossier_id := dossier_of_step(new.step_id);
  if new.contact_id is not null and dossier_of_contact(new.contact_id) is distinct from new.dossier_id then
    raise exception 'L''étape et le contact doivent appartenir au même dossier.' using errcode = '23514';
  end if;
  if new.person_id is not null and not exists (
    select 1 from contact_person p where p.id = new.person_id and p.dossier_id = new.dossier_id and p.contact_id is not distinct from new.contact_id
  ) then
    raise exception 'La personne doit appartenir à l''organisme lié.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop policy contact_step_select on contact_step;
drop policy contact_step_write on contact_step;
create policy contact_step_select on contact_step for select using (is_member(dossier_id));
create policy contact_step_write on contact_step for all using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));

-- 3. Photos : stockage privé, un dossier par dossier d'immigration.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contact-photos', 'contact-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create function storage_dossier(name text) returns uuid
language sql immutable set search_path = public as $$
  select case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' then ((storage.foldername(name))[1])::uuid end;
$$;

create policy contact_photos_select on storage.objects for select
  using (bucket_id = 'contact-photos' and is_member(storage_dossier(name)));
create policy contact_photos_insert on storage.objects for insert
  with check (bucket_id = 'contact-photos' and is_titulaire(storage_dossier(name)));
create policy contact_photos_update on storage.objects for update
  using (bucket_id = 'contact-photos' and is_titulaire(storage_dossier(name)));
create policy contact_photos_delete on storage.objects for delete
  using (bucket_id = 'contact-photos' and is_titulaire(storage_dossier(name)));
