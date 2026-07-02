-- Estado de entrega de WhatsApp para mensajes salientes.
-- Meta acepta el mensaje al instante (status "accepted") pero la entrega real
-- (sent/delivered/read) o el fallo (failed) llegan después vía webhook de estados.
-- Guardamos el id de Meta para poder emparejar esos eventos con la fila.
alter table messages
  add column if not exists wa_message_id text,
  add column if not exists wa_status     text,
  add column if not exists wa_error      jsonb;

-- El webhook busca la fila por el id de Meta en cada actualización de estado.
create index if not exists messages_wa_message_id_idx
  on messages (wa_message_id)
  where wa_message_id is not null;
