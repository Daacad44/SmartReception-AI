import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Send,
  MoreVertical,
  Bot,
  User,
  Phone,
  Tag,
  CheckCheck,
  Calendar,
  ArrowLeft,
  Info,
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
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useConversations, useMessages } from '@/hooks/useApi';
import { useSendMessage, useTakeoverConversation, useMarkConversationRead, useTransferToAi } from '@/hooks/useMutations';
import { useConversationRealtime } from '@/hooks/useRealtime';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { cn, getInitials, formatRelativeTime } from '@/lib/utils';
import type { Message } from '@/lib/entities';

function messageStatusLabel(status: Message['status']): string {
  switch (status) {
    case 'read':
      return 'Message read';
    case 'delivered':
      return 'Message delivered';
    default:
      return 'Message sent';
  }
}
import type { Conversation } from '@/lib/entities';

const statusColors: Record<string, string> = {
  open: 'bg-warning/10 text-warning border-warning/20',
  pending: 'bg-accent/10 text-accent border-accent/20',
  resolved: 'bg-success/10 text-success border-success/20',
  ai_handling: 'bg-primary/10 text-primary border-primary/20',
};

const statusFilters = ['all', 'open', 'pending', 'ai_handling', 'resolved'] as const;

export function ConversationsPage() {
  const navigate = useNavigate();
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
  const { data: messages, isLoading: messagesLoading } = useMessages(selectedId);
  const sendMessage = useSendMessage();
  const takeover = useTakeoverConversation();
  const transferToAi = useTransferToAi();
  const markRead = useMarkConversationRead();

  useConversationRealtime(selectedId);

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
          <div className="flex gap-1 overflow-x-auto">
            {statusFilters.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium capitalize whitespace-nowrap transition-colors',
                  statusFilter === s
                    ? 'bg-accent text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {s === 'ai_handling' ? 'AI' : s}
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
                <Badge className={statusColors[selected.status]}>
                  {selected.status.replace('_', ' ')}
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
              {messagesLoading ? (
                <LoadingState rows={6} />
              ) : (
              <div className="space-y-3">
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
                      {msg.content && <p className="text-sm">{msg.content}</p>}
                      <div className="mt-1 flex items-center justify-end gap-1">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.sender !== 'customer' && (
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
              <div className="flex items-end gap-2">
                <Textarea
                  placeholder="Type a message..."
                  className="min-h-[40px] max-h-24 resize-none"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
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
                  disabled={sendMessage.isPending || !message.trim()}
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
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Contact Info</p>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {selected.customerPhone}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Status</p>
                <Badge className={statusColors[selected.status]}>
                  {selected.status.replace('_', ' ')}
                </Badge>
              </div>

              {selected.assignedTo && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Assigned To</p>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-navy text-white text-[10px]">
                        {getInitials(selected.assignedTo)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{selected.assignedTo}</span>
                  </div>
                </div>
              )}

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
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => selectedId && transferToAi.mutate(selectedId)}
                    disabled={selected.status === 'ai_handling'}
                  >
                    <Bot className="mr-2 h-4 w-4" />
                    Transfer to AI
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
        <p className="text-xs text-muted-foreground truncate mt-0.5">{conversation.lastMessage}</p>
        <div className="mt-1 flex items-center gap-1">
          {conversation.unreadCount > 0 && (
            <Badge className="bg-accent text-white text-[10px] h-4 min-w-4 px-1">
              {conversation.unreadCount}
            </Badge>
          )}
          {conversation.status === 'ai_handling' && (
            <Bot className="h-3 w-3 text-success" />
          )}
        </div>
      </div>
    </button>
  );
}
