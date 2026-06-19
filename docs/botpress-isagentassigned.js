// =============================================================================
// Botpress Studio — Tool "isAgentAssigned"
// =============================================================================
// Vive en Botpress Studio como un "Tool" (acción con input/output schema) que
// usa el nodo autónomo `Agente_ventas`. Se guarda aquí como referencia versionada.
//
// Qué hace:
//   - Resuelve el ID de conversación de Chatwoot desde los tags (vía client.getConversation).
//   - Lo guarda en workflow.chatwootConvId (lo usa el Execute Code para asignar agente).
//   - Consulta a Chatwoot si la conversación ya tiene un agente humano asignado.
//   - DEVUELVE { assigned: true/false } (NO lanza error — eso rompía la LLMZ).
//
// Schemas (configurados en la UI del tool, en Zod):
//   Input Schema:   z.object({})                       // se llama vacío: isAgentAssigned({})
//   Output Schema:  z.object({ assigned: z.boolean() }) // el nodo revisa agentStatus.assigned
//
// Uso en el nodo autónomo:
//   const agentStatus = await isAgentAssigned({})
//   if (agentStatus.assigned) { return { action: 'End1' } }   // hay humano → bot se calla
// =============================================================================

async function action(input: NewActionInput): Promise<NewActionOutput> {
  /** Your code starts below */

  const convId = event.conversationId;
  console.log(">>> Botpress Conv ID:", convId);

  if (!convId) {
    return { assigned: false };
  }

  let chatwootConvId = null;
  try {
    const convDetails = await client.getConversation({ id: convId });
    const tags = convDetails.conversation.tags;
    chatwootConvId = tags?.["michaelbarney/chatwoot:chatwootId"];
    console.log(">>> CHATWOOT ID:", chatwootConvId);
    workflow.chatwootConvId = chatwootConvId ? String(chatwootConvId) : null;
  } catch (e) {
    console.log(">>> Error tags:", e.message);
  }

  if (!chatwootConvId) {
    return { assigned: false };
  }

  try {
    const response = await fetch(
      `https://app.chatwoot.com/api/v1/accounts/169032/conversations/${chatwootConvId}`,
      {
        method: "GET",
        headers: {
          "api_access_token": "zH2WXa3U2WCBccTVzPH6cw2p",
          "Content-Type": "application/json",
        },
      }
    );
    const data = await response.json();
    const assignee = data?.meta?.assignee;
    console.log(">>> ASSIGNEE:", assignee ? assignee.name : "ninguno");

    const assigned = assignee ? true : false;
    workflow.assigned = assigned;
    return { assigned };
  } catch (e) {
    console.log(">>> ERROR:", e.message);
    workflow.assigned = false;
    return { assigned: false };
  }

  /** Your code ends here */
}
