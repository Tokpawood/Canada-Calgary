-- Données d'identité des personnes (naissance, nationalité, pièce d'identité) : réservées au titulaire du dossier.
-- Un lecteur invité voit les fiches et les coordonnées, jamais ces champs.

create table contact_person_private (
  person_id uuid primary key references contact_person(id) on delete cascade,
  dossier_id uuid not null references dossier(id) on delete cascade,
  birth_date date,
  nationality text not null default '',
  id_type text not null default '',
  id_number text not null default ''
);
create index contact_person_private_dossier_idx on contact_person_private(dossier_id);

create function contact_person_private_dossier() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.dossier_id := (select dossier_id from contact_person where id = new.person_id);
  return new;
end;
$$;
create trigger contact_person_private_dossier before insert or update on contact_person_private
  for each row execute function contact_person_private_dossier();

alter table contact_person_private enable row level security;
create policy contact_person_private_owner on contact_person_private for all
  using (is_titulaire(dossier_id)) with check (is_titulaire(dossier_id));

insert into contact_person_private (person_id, dossier_id, birth_date, nationality, id_type, id_number)
  select id, dossier_id, birth_date, nationality, id_type, id_number from contact_person
  where birth_date is not null or nationality <> '' or id_type <> '' or id_number <> '';

alter table contact_person drop column birth_date, drop column nationality, drop column id_type, drop column id_number;
