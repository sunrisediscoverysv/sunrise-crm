-- registered: distingue clientes dados de alta (por un agente o por el bot con
-- datos reales) de contactos mínimos creados solo para que su chat aparezca en
-- la bandeja. Los no registrados muestran el label "No registrado" en el inbox
-- y el botón "Agregar como cliente".
alter table clients add column registered boolean not null default true;

-- Backfill: los contactos auto-creados sin nombre real (sin nombre, o con el
-- teléfono usado como nombre) se consideran no registrados.
update clients
set registered = false
where full_name is null
   or full_name = phone
   or full_name = channel_user_id;
