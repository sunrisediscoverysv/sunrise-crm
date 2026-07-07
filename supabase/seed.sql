-- Seed data: pipeline stages in order
-- Run after migrations: supabase db seed

insert into pipeline_stages (name, position, color, is_won, is_lost, is_frozen) values
  ('Nuevo Cliente',                 1, '#03a5af', false, false, false),
  ('Llamada Agendada',              2, '#075865', false, false, false),
  ('Cita Programada',               3, '#195267', false, false, false),
  ('Negociación',                   4, '#eebb69', false, false, false),
  ('Cerrado',                       5, '#22c55e', true,  false, false),
  ('Congelados / En Stand By',      6, '#94a3b8', false, false, true);
