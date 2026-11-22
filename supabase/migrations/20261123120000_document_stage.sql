-- Étape de la procédure à laquelle sert chaque pièce (vide : déduite du nom, sinon « à classer »).
alter table document add column stage text not null default ''
  check (stage in ('', 'identite', 'langues', 'etudes', 'experience', 'fonds', 'demande', 'arrivee', 'installation'));
