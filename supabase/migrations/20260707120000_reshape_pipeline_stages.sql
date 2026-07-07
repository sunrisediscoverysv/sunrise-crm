-- Reshape the sales pipeline into the funnel Sunrise actually uses:
--   Nuevo Cliente → Llamada Agendada → Cita Programada → Negociación → Cerrado
-- plus a separate "Congelados / En Stand By" bin for leads that stall.
--
-- Stages are renamed IN PLACE (same id) so existing client assignments and
-- stage_history rows are preserved. Only one legacy stage is removed
-- ("Visita / Propuesta enviada"), and its references are repointed first.

-- 1. Flag that marks a stage as an off-funnel "frozen / stand by" bin.
alter table pipeline_stages
  add column if not exists is_frozen boolean not null default false;

-- 2. Rename / reposition the stages that map 1:1 onto the new funnel.
update pipeline_stages set name = 'Nuevo Cliente',            position = 1, color = '#03a5af', is_won = false, is_lost = false, is_frozen = false where name = 'Nuevo lead';
update pipeline_stages set name = 'Llamada Agendada',         position = 2, color = '#075865', is_won = false, is_lost = false, is_frozen = false where name = 'Contactado';
update pipeline_stages set name = 'Cita Programada',          position = 3, color = '#195267', is_won = false, is_lost = false, is_frozen = false where name = 'Calificado';
update pipeline_stages set name = 'Negociación',              position = 4, color = '#eebb69', is_won = false, is_lost = false, is_frozen = false where name = 'Negociación';
update pipeline_stages set name = 'Cerrado',                  position = 5, color = '#22c55e', is_won = true,  is_lost = false, is_frozen = false where name = 'Cerrado - ganado';
update pipeline_stages set name = 'Congelados / En Stand By', position = 6, color = '#94a3b8', is_won = false, is_lost = false, is_frozen = true  where name = 'Cerrado - perdido';

-- 3. Merge the retired "Visita / Propuesta enviada" stage into "Cita Programada".
--    Repoint every foreign-key reference before deleting the row (FKs are NO ACTION).
do $$
declare
  visita_id uuid;
  cita_id   uuid;
begin
  select id into visita_id from pipeline_stages where name = 'Visita / Propuesta enviada';
  select id into cita_id   from pipeline_stages where name = 'Cita Programada';

  if visita_id is not null then
    update clients       set stage_id      = cita_id where stage_id      = visita_id;
    update stage_history set to_stage_id    = cita_id where to_stage_id   = visita_id;
    update stage_history set from_stage_id  = cita_id where from_stage_id = visita_id;
    delete from pipeline_stages where id = visita_id;
  end if;
end $$;
