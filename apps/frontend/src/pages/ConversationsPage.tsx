import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Send,
  MoreVertical,
  Bot,
  User,
  Tag,
  CheckCheck,
  Calendar,
  ArrowLeft,
  Info,
  AlertTriangle,
  LayoutTemplate,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useConversations, useMessages, useConversationTemplates } from '@/hooks/useApi';
import { useSendMessage, useTakeoverConversation, useTransferToAi, useMarkConversationRead } from '@/hooks/useMutations';
import { usePermissions } from '@/hooks/usePermissions';
import { useConversationRealtime } from '@/hooks/useRealtime';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { cn, getInitials, formatRelativeTime, formatMessagePreview } from '@/lib/utils';
import { isNetworkOrTimeoutError } from '@/lib/api';
import type { Message } from '@/lib/entities';
import type { Conversation } from '@/lib/entities';
import {
  CONVERSATION_STATUS_COLORS,
  CONVERSATION_STATUS_FILTERS,
  getStatusLabel,
} from '@/lib/conversation-status';
import { ConversationHandoffPanel } from '@/components/conversations/ConversationHandoffPanel';
import { ConversationModeToggle } from '@/components/conversations/ConversationModeToggle';

function messageStatusLabel(status: Message['status']): string {
  switch (status) {
    case 'failed':
      return 'Failed to send';
    case 'pending':
      return 'Sending…';
    case 'read':
      return 'Message read';
    case 'delivered':
      return 'Message delivered';
    default:
      return 'Message sent';
  }
}

export function ConversationsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [mobilePane, setMobilePane] = useState<'list' | 'chat' | 'details'>('list');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: conversations, isLoading, isError, refetch } = useConversations({
    status: statusFilter,
    search: debouncedSearch || undefined,
  });
  const { data: messagesData, isLoading: messagesLoading, isError: messagesError, isFetching: messagesFetching, refetch: refetchMessages } = useMessages(selectedId);
  const { data: templates, isLoading: templatesLoading } = useConversationTemplates();
  const messages = messagesData?.messages;
  const whatsappSession = messagesData?.whatsappSession;
  const sessionClosed = whatsappSession != null && !whatsappSession.isOpen;
  const sendMessage = useSendMessage();
  const takeover = useTakeoverConversation();
  const returnToAi = useTransferToAi();
  const markRead = useMarkConversationRead();
  const { hasPermission } = usePermissions();
  const canManageHandoff = hasPermission('conversations:write');

  useConversationRealtime(selectedId);

  useEffect(() => {
    const conversationParam = searchParams.get('conversation');
    if (conversationParam) {
      setSelectedId(conversationParam);
      setMobilePane('chat');
      markRead.mutate(conversationParam);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, markRead]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setMobilePane('chat');
    markRead.mutate(id);
  }, [markRead]);

  useEffect(() => {
    if (!message.trim()) {
      setIsTyping(false);
      return;
    }
    setIsTyping(true);
    const t = setTimeout(() => setIsTyping(false), 1500);
    return () => clearTimeout(t);
  }, [message]);

  const handleSend = () => {
    if (!selectedId || !message.trim()) return;
    sendMessage.mutate(
      { conversationId: selectedId, content: message.trim() },
      { onSuccess: () => setMessage('') }
    );
  };

  const handleSendTemplate = (templateId: string) => {
    if (!selectedId) return;
    sendMessage.mutate({ conversationId: selectedId, templateId });
  };

  const filtered = conversations;

  const selected = conversations?.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && filtered && filtered.length > 0) {
      handleSelect(filtered[0].id);
    }
  }, [filtered, selectedId, handleSelect]);

  return (
    <div className="flex h-[calc(100vh-7rem)] -m-4 md:-m-6 overflow-hidden">
      {/* Left pane - conversation list */}
      <div
        className={cn(
          'flex w-full md:w-80 flex-col border-r bg-card',
          mobilePane !== 'list' && 'hidden md:flex'
        )}
      >
        <div className="border-b p-4 space-y-3">
          <h2 className="text-lg font-semibold">Conversations</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {CONVERSATION_STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
                  statusFilter === s
                    ? 'bg-accent text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {s === 'all' ? 'All' : getStatusLabel(s)}
              </button>
            ))}
          </div>
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <LoadingState rows={4} />
          ) : isError ? (
            <ErrorState message="Failed to load conversations" onRetry={() => refetch()} />
          ) : filtered?.length === 0 ? (
            <EmptyState title="No conversations" description="New WhatsApp messages will appear here." />
          ) : (
            filtered?.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={conv.id === selectedId}
              onClick={() => handleSelect(conv.id)}
            />
          ))
          )}
        </ScrollArea>
      </div>

      {/* Center pane - messages */}
      <div
        className={cn(
          'flex flex-1 flex-col bg-muted/40 dark:bg-muted/20',
          mobilePane !== 'chat' && 'hidden md:flex'
        )}
      >
        {selected ? (
          <>
            <div className="flex items-center justify-between border-b bg-card px-4 py-3">
              <div className="flex items-center gap-2 md:gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden shrink-0"
                  onClick={() => setMobilePane('list')}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-accent/10 text-accent text-sm">
                    {getInitials(selected.customerName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">{selected.customerName}</p>
                  <p className="text-xs text-muted-foreground">{selected.customerPhone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canManageHandoff && (
                  <ConversationModeToggle
                    conversation={selected}
                    conversationId={selected.id}
                    onTakeover={() => takeover.mutate(selected.id)}
                    onReturnToAi={() => returnToAi.mutate(selected.id)}
                    takeoverPending={takeover.isPending}
                    returnPending={returnToAi.isPending}
                  />
                )}
                <Badge className={CONVERSATION_STATUS_COLORS[selected.status] ?? ''}>
                  {getStatusLabel(selected.status)}
                </Badge>
                {isTyping && (
                  <span className="text-xs text-muted-foreground animate-pulse">Agent typing...</span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => selectedId && takeover.mutate(selectedId)}>
                      Take over from AI
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="md:hidden"
                      onClick={() => setMobilePane('details')}
                    >
                      View contact details
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">Block contact</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setMobilePane('details')}
                  aria-label="Contact details"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              {messagesLoading && !messages ? (
                <LoadingState rows={6} />
              ) : messagesError ? (
                <ErrorState
                  message={
                    isNetworkOrTimeoutError(messagesError)
                      ? 'Connection lost. Retrying messages...'
                      : 'Failed to load messages.'
                  }
                  onRetry={() => refetchMessages()}
                />
              ) : (
              <div className="space-y-3">
                {messagesFetching && messages && (
                  <p className="text-center text-xs text-muted-foreground animate-pulse">
                    Syncing messages...
                  </p>
                )}
                {messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex',
                      msg.sender === 'customer' ? 'justify-start' : 'justify-end'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[70%] rounded-lg px-3 py-2 shadow-sm',
                        msg.sender === 'customer'
                          ? 'bg-card border border-border'
                          : msg.sender === 'ai'
                            ? 'bg-success/10 border border-success/20 dark:bg-success/20'
                            : 'bg-accent/10 border border-accent/20 dark:bg-accent/20'
                      )}
                    >
                      {msg.sender !== 'customer' && (
                        <div className="mb-1 flex items-center gap-1">
                          {msg.sender === 'ai' ? (
                            <Bot className="h-3 w-3 text-success" />
                          ) : (
                            <User className="h-3 w-3 text-accent" />
                          )}
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {msg.senderName}
                          </span>
                        </div>
                      )}
                      {msg.mediaUrl && (
                        <div className="mb-2">
                          {(msg.type === 'IMAGE' || msg.mediaUrl.match(/\.(jpe?g|png|gif|webp)(\?|$)/i)) && (
                            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer">
                              <img
                                src={msg.mediaUrl}
                                alt={msg.content || 'Image'}
                                className="max-h-48 rounded-md object-cover"
                              />
                            </a>
                          )}
                          {(msg.type === 'VIDEO' || msg.mediaUrl.match(/\.(mp4|webm)(\?|$)/i)) && (
                            <video src={msg.mediaUrl} controls className="max-h-48 rounded-md" />
                          )}
                          {(msg.type === 'AUDIO' || msg.mediaUrl.match(/\.(mp3|ogg|wav|m4a)(\?|$)/i)) && (
                            <audio src={msg.mediaUrl} controls className="w-full" />
                          )}
                          {(msg.type === 'DOCUMENT' ||
                            (!msg.type?.match(/IMAGE|VIDEO|AUDIO/) &&
                              !msg.mediaUrl.match(/\.(jpe?g|png|gif|webp|mp4|webm|mp3|ogg|wav|m4a)(\?|$)/i))) && (
                            <a
                              href={msg.mediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-accent underline"
                            >
                              {msg.content || 'Download document'}
                            </a>
                          )}
                        </div>
                      )}
                      {msg.content && (
                        <p
                          className={cn(
                            'whitespace-pre-wrap break-words text-sm',
                            msg.status === 'failed' && 'text-destructive'
                          )}
                        >
                          {msg.content}
                        </p>
                      )}
                      {msg.status === 'failed' && (
                        <p className="mt-1 text-[10px] font-medium text-destructive">
                          {msg.deliveryError ??
                            'Delivery failed — customer did not receive this message'}
                        </p>
                      )}
                      <div className="mt-1 flex items-center justify-end gap-1">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.sender !== 'customer' && msg.status !== 'failed' && msg.status !== 'pending' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <CheckCheck
                                  className={cn(
                                    'h-3 w-3',
                                    msg.status === 'read'
                                      ? 'text-success'
                                      : msg.status === 'delivered'
                                        ? 'text-muted-foreground'
                                        : 'text-muted-foreground/60'
                                  )}
                                  aria-label={messageStatusLabel(msg.status)}
                                />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">{messageStatusLabel(msg.status)}</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </ScrollArea>

            <div className="border-t bg-card p-3">
              {sessionClosed && (
                <div className="mb-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">24-hour WhatsApp session expired</p>
                    <p className="mt-0.5 text-warning/90">
                      {whatsappSession?.lastInboundAt
                        ? 'Free-form replies are blocked. Use Templates below to send a prepared message anytime (requires Meta-approved template in Settings).'
                        : 'This customer has not sent a WhatsApp message yet. Use Templates to send an approved opening message.'}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-end gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      disabled={sendMessage.isPending || templatesLoading || !selectedId}
                      title="Send template"
                    >
                      <LayoutTemplate className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-80">
                    <DropdownMenuLabel>Send template</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {templatesLoading && (
                      <DropdownMenuItem disabled>Loading templates…</DropdownMenuItem>
                    )}
                    {!templatesLoading && !templates?.length && (
                      <DropdownMenuItem disabled>
                        No templates — add one in Campaigns → Templates
                      </DropdownMenuItem>
                    )}
                    {templates?.map((tpl) => (
                      <DropdownMenuItem
                        key={tpl.id}
                        className="flex flex-col items-start gap-1 py-2"
                        onClick={() => handleSendTemplate(tpl.id)}
                      >
                        <span className="font-medium">{tpl.name}</span>
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {formatMessagePreview(tpl.content)}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Textarea
                  placeholder={
                    sessionClosed
                      ? 'Session expired — wait for customer to message or use a template'
                      : 'Type a message...'
                  }
                  className="min-h-[40px] max-h-24 resize-none"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={sessionClosed}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="shrink-0 bg-accent hover:bg-accent/90"
                  disabled={sendMessage.isPending || !message.trim() || sessionClosed}
                  onClick={handleSend}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Select a conversation to start messaging
          </div>
        )}
      </div>

      {/* Right pane - contact details */}
      <div
        className={cn(
          'flex w-full md:w-72 flex-col border-l bg-card',
          mobilePane !== 'details' && 'hidden md:flex'
        )}
      >
        {selected ? (
          <ScrollArea className="flex-1 p-4">
            <Button
              variant="ghost"
              size="sm"
              className="mb-4 md:hidden"
              onClick={() => setMobilePane('chat')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to chat
            </Button>
            <div className="text-center">
              <Avatar className="mx-auto h-16 w-16">
                <AvatarFallback className="bg-accent/10 text-accent text-lg">
                  {getInitials(selected.customerName)}
                </AvatarFallback>
              </Avatar>
              <h3 className="mt-3 font-semibold">{selected.customerName}</h3>
              <p className="text-sm text-muted-foreground">{selected.customerPhone}</p>
            </div>

            <Separator className="my-4" />

            <div className="space-y-4">
              <ConversationHandoffPanel conversation={selected} conversationId={selected.id} />

              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {selected.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      <Tag className="mr-1 h-3 w-3" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Quick Actions</p>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => navigate(`/appointments?customer=${selected.customerId}`)}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule Appointment
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => navigate(`/customers?highlight=${selected.customerId}`)}
                  >
                    <User className="mr-2 h-4 w-4" />
                    View Customer Profile
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
            Contact details will appear here
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 border-b p-4 text-left transition-colors hover:bg-muted/50',
        isSelected && 'bg-accent/5 border-l-2 border-l-accent'
      )}
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className="bg-accent/10 text-accent text-sm">
          {getInitials(conversation.customerName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium truncate">{conversation.customerName}</p>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatRelativeTime(conversation.lastMessageAt)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground break-words">
          {formatMessagePreview(conversation.lastMessage)}
        </p>
        <div className="mt-1 flex items-center gap-1">
          {conversation.unreadCount > 0 && (
            <Badge className="bg-accent text-white text-[10px] h-4 min-w-4 px-1">
              {conversation.unreadCount}
            </Badge>
          )}
          {conversation.status === 'ai_handling' && (
            <Bot className="h-3 w-3 text-blue-500" />
          )}
          {conversation.status === 'human_needed' && (
            <Badge className="h-4 px-1 text-[9px] bg-orange-500/15 text-orange-600 border-orange-500/20">
              Human
            </Badge>
          )}
          {conversation.status === 'human_handling' && (
            <User className="h-3 w-3 text-green-600" />
          )}
        </div>
      </div>
    </button>
  );
}
