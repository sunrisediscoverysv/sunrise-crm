-- Espejo del estado de las conversaciones de Chatwoot, para que Botpress pueda
-- preguntarle al CRM "¿esta persona ya la está atendiendo un humano?".
--
-- Por qué una tabla nueva y no columnas en `clients`:
--   * El estado (agente, status) es POR CONVERSACIÓN, y un mismo contacto puede
--     tener varias conversaciones históricas en Chatwoot.
--   * `messages.raw_payload->>chatwoot_conversation_id` ya guarda el vínculo,
--     pero es un JSONB sin índice, sin agente y sin status; consultarlo por
--     usuario externo obligaría a escanear mensajes.
-- Chatwoot es la fuente de verdad; esto es solo una copia de lectura rápida.
create table if not exists chatwoot_conversations (
  chatwoot_conversation_id bigint primary key,
  chatwoot_contact_id      bigint,
  chatwoot_inbox_id        bigint,

  channel text not null check (channel in ('whatsapp', 'instagram', 'messenger', 'other')),

  -- Identidades del usuario externo. Se guardan TODAS las que Chatwoot exponga
  -- porque cuál coincide con el id que ve Botpress depende del canal:
  --   * source_id          → PSID/IGSID de Meta (lo que Botpress llama
  --                          instagram:id / messenger:id). Viene de la API
  --                          (contact_inboxes), no del webhook.
  --   * contact_identifier → `meta.sender.identifier` del webhook; en algunos
  --                          canales trae el mismo id de Meta, en otros es null.
  --   * phone_digits       → WhatsApp, solo dígitos (contrato ya usado por
  --                          botpress-webhook y chatwoot-webhook).
  source_id          text,
  contact_identifier text,
  phone_digits       text,

  status        text,
  assignee_id   bigint,
  assignee_name text,
  is_assigned   boolean not null default false,

  client_id uuid references clients(id) on delete set null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_event_at timestamptz not null default now()
);

-- Búsqueda del endpoint: por canal + cada una de las identidades posibles.
-- Parciales para no indexar las filas donde la columna es null.
create index if not exists chatwoot_conversations_source_id_idx
  on chatwoot_conversations (channel, source_id) where source_id is not null;
create index if not exists chatwoot_conversations_identifier_idx
  on chatwoot_conversations (channel, contact_identifier) where contact_identifier is not null;
create index if not exists chatwoot_conversations_phone_idx
  on chatwoot_conversations (channel, phone_digits) where phone_digits is not null;
create index if not exists chatwoot_conversations_contact_idx
  on chatwoot_conversations (channel, chatwoot_contact_id) where chatwoot_contact_id is not null;
-- Desempate "conversación más relevante": la más reciente primero.
create index if not exists chatwoot_conversations_recent_idx
  on chatwoot_conversations (last_event_at desc);
create index if not exists chatwoot_conversations_client_idx
  on chatwoot_conversations (client_id) where client_id is not null;

alter table chatwoot_conversations enable row level security;

-- Solo lectura para el CRM; la escritura la hacen las Edge Functions con la
-- service_role key, que salta RLS.
create policy "Authenticated users can select chatwoot_conversations"
  on chatwoot_conversations for select
  using (auth.uid() is not null);

create trigger set_chatwoot_conversations_updated_at
  before update on chatwoot_conversations
  for each row execute procedure update_updated_at_column();
