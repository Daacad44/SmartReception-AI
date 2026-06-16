import { useState, useEffect } from 'react';
import {
  Search,
  Send,
  Paperclip,
  MoreVertical,
  Bot,
  User,
  Phone,
  Tag,
  CheckCheck,
  Calendar,
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
import { useConversations, useMessages } from '@/hooks/useApi';
import { cn, getInitials, formatRelativeTime } from '@/lib/utils';
import type { Conversation } from '@/lib/mock-data';

const statusColors: Record<string, string> = {
  open: 'bg-warning/10 text-warning border-warning/20',
  pending: 'bg-accent/10 text-accent border-accent/20',
  resolved: 'bg-success/10 text-success border-success/20',
  ai_handling: 'bg-primary/10 text-primary border-primary/20',
};

const statusFilters = ['all', 'open', 'pending', 'ai_handling', 'resolved'] as const;

export function ConversationsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [message, setMessage] = useState('');

  const { data: conversations } = useConversations();
  const { data: messages } = useMessages(selectedId);

  const filtered = conversations?.filter((c) => {
    const matchesSearch =
      !search ||
      c.customerName.toLowerCase().includes(search.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selected = conversations?.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && filtered && filtered.length > 0) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  return (
    <div className="flex h-[calc(100vh-7rem)] -m-6 overflow-hidden">
      {/* Left pane - conversation list */}
      <div className="flex w-80 flex-col border-r bg-white">
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
          {filtered?.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={conv.id === selectedId}
              onClick={() => setSelectedId(conv.id)}
            />
          ))}
        </ScrollArea>
      </div>

      {/* Center pane - messages */}
      <div className="flex flex-1 flex-col bg-[#E5DDD5]">
        {selected ? (
          <>
            <div className="flex items-center justify-between border-b bg-white px-4 py-3">
              <div className="flex items-center gap-3">
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Assign to agent</DropdownMenuItem>
                    <DropdownMenuItem>Mark as resolved</DropdownMenuItem>
                    <DropdownMenuItem>Transfer to AI</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">Block contact</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
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
                          ? 'bg-white'
                          : msg.sender === 'ai'
                            ? 'bg-[#DCF8C6] border border-success/20'
                            : 'bg-[#DCF8C6]'
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
                      <p className="text-sm">{msg.content}</p>
                      <div className="mt-1 flex items-center justify-end gap-1">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.sender !== 'customer' && (
                          <CheckCheck className="h-3 w-3 text-success" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="border-t bg-white p-3">
              <div className="flex items-end gap-2">
                <Button variant="ghost" size="icon" className="shrink-0">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Textarea
                  placeholder="Type a message..."
                  className="min-h-[40px] max-h-24 resize-none"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      setMessage('');
                    }
                  }}
                />
                <Button size="icon" className="shrink-0 bg-accent hover:bg-accent/90">
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
      <div className="flex w-72 flex-col border-l bg-white">
        {selected ? (
          <ScrollArea className="flex-1 p-4">
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
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule Appointment
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <User className="mr-2 h-4 w-4" />
                    View Customer Profile
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
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
