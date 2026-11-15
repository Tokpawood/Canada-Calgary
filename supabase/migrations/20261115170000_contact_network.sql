-- Réseau des contacts : des personnes par organisme (mini-organigramme) et des liens contacts <-> étapes.

create function dossier_of_contact(c_id text) returns uuid
language sql security definer stable set search_path = public as $$
  select dossier_id from contact where id = c_id;
$$;

create table contact_person (
  id uuid primary key default gen_random_uuid(),
  contact_id text not null references contact(id) on delete cascade,
  parent_id uuid references contact_person(id) on delete set null,
  name text not null check (btrim(name) <> '' and length(name) <= 120),
  title text not null default '',
  email text not null default '',
  phone text not null default '',
  notes text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now(),
  constraint contact_person_not_self check (parent_id is null or parent_id <> id)
);
create index contact_person_contact_idx on contact_person(contact_id);
create index contact_person_parent_idx on contact_person(parent_id);

-- Le responsable d'une personne appartient au même organisme.
create function contact_person_same_org() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.parent_id is not null and not exists (select 1 from contact_person p where p.id = new.parent_id and p.contact_id = new.contact_id) then
    raise exception 'Le responsable doit appartenir au même organisme.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger contact_person_same_org before insert or update of parent_id, contact_id on contact_person
  for each row execute function contact_person_same_org();

create table contact_step (
  id uuid primary key default gen_random_uuid(),
  step_id text not null references step(id) on delete cascade,
  contact_id text not null references contact(id) on delete cascade,
  person_id uuid references contact_person(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index contact_step_unique on contact_step(step_id, contact_id, coalesce(person_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index contact_step_contact_idx on contact_step(contact_id);

-- La personne liée appartient à l'organisme lié, et l'étape au même dossier.
create function contact_step_consistent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.person_id is not null and not exists (select 1 from contact_person p where p.id = new.person_id and p.contact_id = new.contact_id) then
    raise exception 'La personne doit appartenir à l''organisme lié.' using errcode = '23514';
  end if;
  if dossier_of_step(new.step_id) is distinct from dossier_of_contact(new.contact_id) then
    raise exception 'L''étape et le contact doivent appartenir au même dossier.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger contact_step_consistent before insert or update on contact_step
  for each row execute function contact_step_consistent();

alter table contact_person enable row level security;
alter table contact_step enable row level security;

create policy contact_person_select on contact_person for select using (is_member(dossier_of_contact(contact_id)));
create policy contact_person_write on contact_person for all using (is_titulaire(dossier_of_contact(contact_id))) with check (is_titulaire(dossier_of_contact(contact_id)));

create policy contact_step_select on contact_step for select using (is_member(dossier_of_contact(contact_id)));
create policy contact_step_write on contact_step for all
  using (is_titulaire(dossier_of_contact(contact_id)))
  with check (is_titulaire(dossier_of_contact(contact_id)) and is_titulaire(dossier_of_step(step_id)));

-- L'ancien champ « interlocuteur » (texte libre) devient une personne de l'organisme, y compris lors d'un import.
create function contact_person_from_legacy() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if btrim(coalesce(new.person, '')) <> '' then
    insert into contact_person (contact_id, name) values (new.id, left(btrim(new.person), 120));
    update contact set person = '' where id = new.id;
  end if;
  return null;
end;
$$;
create trigger contact_person_from_legacy after insert or update of person on contact
  for each row execute function contact_person_from_legacy();

insert into contact_person (contact_id, name)
  select id, left(btrim(person), 120) from contact where btrim(person) <> '';
update contact set person = '' where btrim(person) <> '';
