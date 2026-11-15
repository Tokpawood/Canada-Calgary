-- Import : les scans gardent leur pièce après un ré-import ; dossier_id forcé ; id jamais réécrit sur conflit.
create or replace function import_dossier(p_dossier_id uuid, p_dossier jsonb, p_tables jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  allowed constant text[] := array[
    'identity', 'profile', 'fsw', 'step', 'step_task', 'step_link', 'document', 'document_check', 'document_link',
    'saving', 'contact', 'contact_person', 'contact_person_private', 'contact_step', 'gap', 'history', 'address'
  ];
  one_per_dossier constant text[] := array['identity', 'profile', 'fsw'];
  item jsonb;
  t text;
  data_rows jsonb;
  cols text[];
  col_list text;
  set_list text;
  v_min integer := coalesce(round((p_dossier->>'funds_min')::numeric)::integer, 0);
  v_target integer := coalesce(round((p_dossier->>'funds_target')::numeric)::integer, 0);
  v_min_cad integer := round((p_dossier->>'funds_min_cad')::numeric)::integer;
  v_date date := nullif(p_dossier->>'profile_date', '')::date;
  v_links jsonb;
begin
  if auth.uid() is null then
    raise exception 'Session expirée.' using errcode = '42501';
  end if;

  if exists (select 1 from dossier where id = p_dossier_id) then
    if not is_titulaire(p_dossier_id) then
      raise exception 'Seul le titulaire peut importer dans ce dossier.' using errcode = '42501';
    end if;
    update dossier
      set profile_date = v_date, funds_min = v_min, funds_target = v_target, funds_min_cad = v_min_cad
      where id = p_dossier_id;
    -- Les scans du coffre restent rattachés à leurs pièces si celles-ci sont réimportées (même identifiant).
    select jsonb_agg(jsonb_build_object('f', id, 'd', document_id)) into v_links
      from file where dossier_id = p_dossier_id and document_id is not null;
    delete from step where dossier_id = p_dossier_id;
    delete from document where dossier_id = p_dossier_id;
    delete from saving where dossier_id = p_dossier_id;
    delete from contact_person where dossier_id = p_dossier_id;
    delete from contact where dossier_id = p_dossier_id;
    delete from gap where dossier_id = p_dossier_id;
    delete from history where dossier_id = p_dossier_id;
    delete from address where dossier_id = p_dossier_id;
  else
    insert into dossier (id, owner_id, profile_date, funds_min, funds_target, funds_min_cad)
      values (p_dossier_id, auth.uid(), v_date, v_min, v_target, v_min_cad);
  end if;

  for item in select e.value from jsonb_array_elements(coalesce(p_tables, '[]'::jsonb)) with ordinality as e(value, n) order by e.n loop
    t := item->>'table';
    data_rows := item->'rows';
    if t is null or not (t = any(allowed)) then
      raise exception 'Table non autorisée : %', t;
    end if;
    if data_rows is null or jsonb_typeof(data_rows) <> 'array' or jsonb_array_length(data_rows) = 0 then
      continue;
    end if;
    -- Toute ligne portant un dossier_id est rattachée au dossier importé, quel que soit le fichier.
    select jsonb_agg(case when e.value ? 'dossier_id' then e.value || jsonb_build_object('dossier_id', p_dossier_id) else e.value end)
      into data_rows from jsonb_array_elements(data_rows) as e(value);

    select array_agg(distinct k order by k) into cols
      from jsonb_array_elements(data_rows) as r(value), jsonb_object_keys(r.value) as k;
    select string_agg(format('%I', c), ', ') into col_list from unnest(cols) as c;

    if t = any(one_per_dossier) then
      select string_agg(format('%1$I = excluded.%1$I', c), ', ') into set_list from unnest(cols) as c where c not in ('dossier_id', 'id');
      execute format(
        'insert into %I (%s) select %s from jsonb_populate_recordset(null::%I, $1) on conflict (dossier_id) do %s',
        t, col_list, col_list, t, case when set_list is null then 'nothing' else 'update set ' || set_list end
      ) using data_rows;
    else
      execute format('insert into %I (%s) select %s from jsonb_populate_recordset(null::%I, $1)', t, col_list, col_list, t)
        using data_rows;
    end if;
  end loop;

  if v_links is not null then
    update file f set document_id = l->>'d'
      from jsonb_array_elements(v_links) as l
      where f.id = (l->>'f')::uuid
        and exists (select 1 from document d where d.id = l->>'d' and d.dossier_id = p_dossier_id);
  end if;
end;
$$;

revoke execute on function import_dossier(uuid, jsonb, jsonb) from public, anon;
grant execute on function import_dossier(uuid, jsonb, jsonb) to authenticated;
