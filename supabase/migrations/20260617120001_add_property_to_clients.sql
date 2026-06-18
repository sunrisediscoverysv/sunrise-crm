-- Vincular un lead a una propiedad del catálogo (opcional).
-- Se mantiene clients.property_of_interest (texto libre) por compatibilidad.
alter table clients
  add column property_id uuid references properties(id) on delete set null;
