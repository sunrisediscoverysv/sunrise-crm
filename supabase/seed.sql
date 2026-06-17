-- Seed data: pipeline stages in order
-- Run after migrations: supabase db seed

insert into pipeline_stages (name, position, color, is_won, is_lost) values
  ('Nuevo lead',                    1, '#03a5af', false, false),
  ('Contactado',                    2, '#075865', false, false),
  ('Calificado',                    3, '#195267', false, false),
  ('Visita / Propuesta enviada',    4, '#114252', false, false),
  ('Negociación',                   5, '#eebb69', false, false),
  ('Cerrado - ganado',              6, '#22c55e', true,  false),
  ('Cerrado - perdido',             7, '#ef4444', false, true);
