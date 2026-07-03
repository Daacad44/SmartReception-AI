import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api, { extractData, getErrorMessage } from '@/lib/api';
import { parseMutationResponse } from '@/lib/governance';

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
      templateId,
    }: {
      conversationId: string;
      content?: string;
      templateId?: string;
    }) => {
      const payload = templateId ? { templateId } : { content: content! };
      const response = await api.post(`/conversations/${conversationId}/messages`, payload);
      return extractData(response);
    },
    onSuccess: (_data, { conversationId, templateId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(templateId ? 'Template sent to WhatsApp' : 'Message sent to WhatsApp');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; phone: string; email?: string; notes?: string }) => {
      const response = await api.post('/customers', data);
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer created');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; phone?: string; email?: string; notes?: string };
    }) => {
      const response = await api.patch(`/customers/${id}`, data);
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer updated');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      customerId: string;
      serviceId?: string;
      title: string;
      startTime: string;
      endTime: string;
      notes?: string;
    }) => {
      const response = await api.post('/appointments', data);
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment created');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        title?: string;
        startTime?: string;
        endTime?: string;
        status?: string;
        notes?: string;
        customerId?: string;
        serviceId?: string;
      };
    }) => {
      const response = await api.patch(`/appointments/${id}`, data);
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment updated');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/appointments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment cancelled');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useTakeoverConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await api.post(`/conversations/${conversationId}/takeover`);
      return extractData(response);
    },
    onSuccess: (_data, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversation-activity', conversationId] });
      toast.success('You took over this conversation');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await api.patch(`/conversations/${conversationId}/read`);
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: () => {
      // Non-blocking: read status should not interrupt the inbox
    },
  });
}

export function useTransferToAi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await api.post(`/conversations/${conversationId}/transfer-ai`);
      return extractData(response);
    },
    onSuccess: (_data, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversation-activity', conversationId] });
      toast.success('Conversation returned to AI');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

function invalidateConversationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string
) {
  queryClient.invalidateQueries({ queryKey: ['conversations'] });
  queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
  queryClient.invalidateQueries({ queryKey: ['conversation-activity', conversationId] });
}

export function useAssignConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      conversationId: string;
      assigneeId: string;
      team?: 'SUPPORT' | 'SALES' | 'TECHNICAL' | 'GENERAL';
    }) => {
      const response = await api.post(`/conversations/${params.conversationId}/assign`, {
        assigneeId: params.assigneeId,
        team: params.team,
      });
      return extractData(response);
    },
    onSuccess: (_data, params) => {
      invalidateConversationQueries(queryClient, params.conversationId);
      toast.success('Conversation assigned');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useTransferConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      conversationId: string;
      assigneeId?: string;
      team?: 'SUPPORT' | 'SALES' | 'TECHNICAL' | 'GENERAL';
    }) => {
      const response = await api.post(`/conversations/${params.conversationId}/transfer`, {
        assigneeId: params.assigneeId,
        team: params.team,
      });
      return extractData(response);
    },
    onSuccess: (_data, params) => {
      invalidateConversationQueries(queryClient, params.conversationId);
      toast.success('Conversation transferred');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useResolveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await api.post(`/conversations/${conversationId}/resolve`);
      return extractData(response);
    },
    onSuccess: (_data, conversationId) => {
      invalidateConversationQueries(queryClient, conversationId);
      toast.success('Conversation resolved');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useCloseConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await api.post(`/conversations/${conversationId}/close`);
      return extractData(response);
    },
    onSuccess: (_data, conversationId) => {
      invalidateConversationQueries(queryClient, conversationId);
      toast.success('Conversation closed');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useRequestHuman() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await api.post(`/conversations/${conversationId}/request-human`);
      return extractData(response);
    },
    onSuccess: (_data, conversationId) => {
      invalidateConversationQueries(queryClient, conversationId);
      toast.success('Human support requested');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useAddCustomerNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, content }: { customerId: string; content: string }) => {
      const response = await api.post(`/customers/${customerId}/notes`, { content });
      return extractData(response);
    },
    onSuccess: (_data, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId] });
      toast.success('Note added');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useAssignCustomerTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, tagIds }: { customerId: string; tagIds: string[] }) => {
      const response = await api.put(`/customers/${customerId}/tags`, { tagIds });
      return extractData(response);
    },
    onSuccess: (_data, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers', customerId] });
      toast.success('Tags updated');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useCreateCustomerTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; color?: string }) => {
      const response = await api.post('/customers/tags', data);
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', 'tags'] });
      toast.success('Tag created');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useChangePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (plan: string) => {
      const response = await api.post('/billing/change-plan', { plan });
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      toast.success('Plan updated');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useStripeCheckout() {
  return useMutation({
    mutationFn: async (plan: string) => {
      const response = await api.post('/billing/checkout', { plan });
      return extractData<{ url: string }>(response);
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useStripePortal() {
  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/billing/portal');
      return extractData<{ url: string }>(response);
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useConnectWhatsApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      phoneNumberId: string;
      phoneNumber: string;
      displayName?: string;
      wabaId?: string;
      accessToken: string;
    }) => {
      const response = await api.post('/whatsapp/accounts', data);
      return parseMutationResponse(response);
    },
    onSuccess: (result) => {
      if (result.kind === 'approval') {
        toast.info('Administrator approval required', {
          description: 'Your WhatsApp connect request was submitted for review.',
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-health'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-webhook-health'] });
      toast.success('WhatsApp account connected');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useConnectWhatsAppOAuth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { code: string; wabaId: string; phoneNumberId: string }) => {
      const response = await api.post('/whatsapp/oauth/exchange', data);
      return parseMutationResponse(response);
    },
    onSuccess: (result) => {
      if (result.kind === 'approval') {
        toast.info('Administrator approval required', {
          description: 'Your WhatsApp connect request was submitted for review.',
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-health'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-webhook-health'] });
      toast.success('WhatsApp connected via Facebook');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useConnectWhatsAppFromEnv() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/whatsapp/connect-env');
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-health'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-webhook-health'] });
      toast.success('WhatsApp connected from environment variables');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useTestWhatsAppConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId?: string) => {
      const response = await api.post('/whatsapp/test', { accountId });
      return extractData<{
        verifiedName?: string;
        displayPhoneNumber?: string;
        qualityRating?: string;
      }>(response);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-health'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-webhook-health'] });
      toast.success(
        `Connection OK${data?.verifiedName ? `: ${data.verifiedName}` : ''}`
      );
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateWhatsAppAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      accountId,
      data,
    }: {
      accountId: string;
      data: {
        reengagementTemplateName?: string | null;
        reengagementTemplateLanguage?: string | null;
        reengagementTemplateHasBodyVariable?: boolean;
      };
    }) => {
      const response = await api.patch(`/whatsapp/accounts/${accountId}`, data);
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
      toast.success('WhatsApp template settings saved');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDisconnectWhatsApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      await api.delete(`/whatsapp/accounts/${accountId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-health'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-webhook-health'] });
      toast.success('WhatsApp account disconnected');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: async (token: string) => {
      const response = await api.post('/team/accept-invite', { token });
      return extractData(response);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useCreateFaq() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      knowledgeBaseId: string;
      question: string;
      answer: string;
      category?: string;
    }) => {
      const response = await api.post('/knowledge/faqs', data);
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      toast.success('FAQ created');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      title,
      knowledgeBaseId,
    }: {
      file: File;
      title?: string;
      knowledgeBaseId?: string;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (title) formData.append('title', title);
      if (knowledgeBaseId) formData.append('knowledgeBaseId', knowledgeBaseId);

      const response = await api.post('/knowledge/documents/upload', formData, {
        timeout: 60000,
      });
      const result = parseMutationResponse<{ id: string }>(response);
      if (result.kind === 'approval') {
        return result;
      }
      const document = result.data;

      // Trigger background processing (fire-and-forget, short timeout)
      api.post(`/knowledge/documents/${document.id}/process`, undefined, { timeout: 8000 }).catch(() => undefined);

      return { kind: 'success' as const, data: document };
    },
    onSuccess: (result) => {
      if (result && typeof result === 'object' && 'kind' in result && result.kind === 'approval') {
        toast.info('Administrator approval required', {
          description: 'Your upload request was submitted for Super Admin review.',
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      queryClient.invalidateQueries({ queryKey: ['ai-training'] });
      toast.success('Document uploaded — processing in background');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      await api.delete(`/knowledge/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      toast.success('Document deleted');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useClearKnowledgeBase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => extractData<{ deleted: number }>(await api.delete('/knowledge/clear')),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-search'] });
      toast.success(
        data.deleted > 0
          ? `Knowledge base cleared (${data.deleted} item${data.deleted === 1 ? '' : 's'} removed)`
          : 'Knowledge base is already empty'
      );
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useInviteTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const response = await api.post('/team/invite', data);
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Invitation sent');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const response = await api.patch(`/team/${memberId}`, { role });
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Team member updated');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      await api.delete(`/team/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Team member removed');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateBusinessSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name?: string;
      timezone?: string;
      phone?: string;
      email?: string;
      website?: string;
      address?: string;
    }) => {
      const response = await api.patch('/business/settings', data);
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business'] });
      toast.success('Settings updated');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateAiConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await api.put('/ai/config', data);
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai', 'config'] });
      toast.success('AI configuration updated');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}
