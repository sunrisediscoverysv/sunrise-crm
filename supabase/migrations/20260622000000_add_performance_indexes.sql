-- Índices de rendimiento para soportar volumen.
-- Postgres NO crea índices automáticos para foreign keys; sin estos, las
-- consultas del dashboard, pipeline y listado de clientes hacen full scan
-- a medida que crecen las filas. Todos son seguros de aplicar (idempotentes).

-- clients: columnas usadas en filtros y ordenamientos frecuentes
create index if not exists idx_clients_stage_id    on clients (stage_id);
create index if not exists idx_clients_assigned_to on clients (assigned_to);
create index if not exists idx_clients_property_id on clients (property_id);
create index if not exists idx_clients_channel     on clients (channel);
-- created_at desc: dashboard "leads recientes" y orden por defecto del listado
create index if not exists idx_clients_created_at  on clients (created_at desc);

-- messages: el FK client_id se usa al cargar el historial y para el on delete cascade
create index if not exists idx_messages_client_id  on messages (client_id);
create index if not exists idx_messages_created_at  on messages (created_at desc);

-- stage_history: auditoría consultada por cliente
create index if not exists idx_stage_history_client_id on stage_history (client_id);
