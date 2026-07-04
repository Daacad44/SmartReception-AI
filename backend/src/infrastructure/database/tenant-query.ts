/** Conversation/message queries must always scope by businessId to prevent cross-tenant access. */
export function conversationScope(conversationId: string, businessId: string) {
  return { id: conversationId, businessId };
}

export function conversationMessageScope(conversationId: string, businessId: string) {
  return { conversationId, conversation: { businessId } };
}
