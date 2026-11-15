-- Étape de la relation avec un organisme (colonnes du tableau kanban des contacts).
alter table contact add column stage text not null default 'a-contacter'
  check (stage in ('a-contacter', 'en-contact', 'en-attente', 'etabli', 'termine'));
update contact set stage = case when btrim(next) <> '' then 'en-attente' else 'en-contact' end;
