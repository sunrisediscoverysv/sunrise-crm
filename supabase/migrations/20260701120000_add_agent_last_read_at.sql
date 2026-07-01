-- agent_last_read_at: marca de "leído" compartida por el equipo para la bandeja
-- de conversaciones. Si hay un mensaje inbound más reciente que esta marca, la
-- conversación se muestra como no leída. Se actualiza al abrir el hilo en el CRM.
alter table clients
  add column agent_last_read_at timestamptz;
