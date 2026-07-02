-- Habilita Realtime (postgres_changes) para la tabla messages.
-- Sin esto, la suscripción del inbox se conecta pero nunca recibe eventos
-- y las conversaciones solo se actualizan al refetchear manualmente.
alter publication supabase_realtime add table messages;
