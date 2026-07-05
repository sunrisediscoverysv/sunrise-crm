-- Identidad canónica de WhatsApp: channel_user_id = solo dígitos.
--
-- Botpress creaba clientes con channel_user_id '+50370267269' (con +) mientras
-- chatwoot-webhook busca/crea con solo dígitos ('50370267269'). Consecuencias:
-- los salientes del bot se descartaban como client_not_found y una misma
-- persona podía quedar como dos contactos (conversación partida en dos).
--
-- 1) Fusionar duplicados existentes (misma persona en ambos formatos): se
--    conserva la fila de dígitos, se le mueven los hijos y se rellenan campos
--    vacíos con los del duplicado; luego se elimina la fila con '+'.
do $$
declare pair record;
begin
  for pair in
    select a.id as src, b.id as dst
    from clients a
    join clients b
      on b.channel = a.channel
     and b.channel_user_id = regexp_replace(a.channel_user_id, '\D', '', 'g')
     and b.id <> a.id
    where a.channel = 'whatsapp' and a.channel_user_id ~ '\D'
  loop
    update messages           set client_id = pair.dst where client_id = pair.src;
    update client_comments    set client_id = pair.dst where client_id = pair.src;
    update stage_history      set client_id = pair.dst where client_id = pair.src;
    update client_attachments set client_id = pair.dst where client_id = pair.src;
    update appointments       set client_id = pair.dst where client_id = pair.src;

    update clients d set
      full_name            = coalesce(nullif(d.full_name, d.phone), nullif(s.full_name, s.phone), d.full_name, s.full_name),
      email                = coalesce(d.email, s.email),
      phone                = coalesce(d.phone, s.phone),
      interest_type        = coalesce(d.interest_type, s.interest_type),
      property_of_interest = coalesce(d.property_of_interest, s.property_of_interest),
      property_id          = coalesce(d.property_id, s.property_id),
      budget_range         = coalesce(d.budget_range, s.budget_range),
      source               = coalesce(d.source, s.source),
      stage_id             = coalesce(d.stage_id, s.stage_id),
      assigned_to          = coalesce(d.assigned_to, s.assigned_to),
      follow_up_at         = coalesce(d.follow_up_at, s.follow_up_at),
      registered           = d.registered or s.registered,
      agent_last_read_at   = greatest(d.agent_last_read_at, s.agent_last_read_at),
      last_contact_at      = greatest(d.last_contact_at, s.last_contact_at),
      created_at           = least(d.created_at, s.created_at)
    from clients s
    where d.id = pair.dst and s.id = pair.src;

    delete from clients where id = pair.src;
  end loop;
end $$;

-- 2) Normalizar el resto (sin colisión) al formato canónico de dígitos.
update clients
set channel_user_id = regexp_replace(channel_user_id, '\D', '', 'g')
where channel = 'whatsapp' and channel_user_id ~ '\D';
