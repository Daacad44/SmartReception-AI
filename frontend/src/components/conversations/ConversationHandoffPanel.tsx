import { useState } from 'react';
import {
  Bot,
  User,
  UserCheck,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Star,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useConversationActivity,
  useTeamMembers,
} from '@/hooks/useApi';
import {
  useTakeoverConversation,
  useTransferToAi,
  useAssignConversation,
  useTransferConversation,
  useResolveConversation,
  useCloseConversation,
  useRequestHuman,
} from '@/hooks/useMutations';
import type { Conversation } from '@/lib/entities';
import {
  CONVERSATION_STATUS_COLORS,
  getStatusLabel,
} from '@/lib/conversation-status';
import { formatRelativeTime } from '@/lib/utils';

interface ConversationHandoffPanelProps {
  conversation: Conversation;
  conversationId: string;
}

const TEAMS = [
  { value: 'SUPPORT', label: 'Support Team' },
  { value: 'SALES', label: 'Sales Team' },
  { value: 'TECHNICAL', label: 'Technical Team' },
  { value: 'GENERAL', label: 'General' },
] as const;

export function ConversationHandoffPanel({
  conversation,
  conversationId,
}: ConversationHandoffPanelProps) {
  const { data: activity, isLoading: activityLoading } = useConversationActivity(conversationId);
  const { data: teamMembers } = useTeamMembers();
  const [assigneeId, setAssigneeId] = useState('');
  const [team, setTeam] = useState<string>('SUPPORT');

  const takeover = useTakeoverConversation();
  const returnToAi = useTransferToAi();
  const assign = useAssignConversation();
  const transfer = useTransferConversation();
  const resolve = useResolveConversation();
  const close = useCloseConversation();
  const requestHuman = useRequestHuman();

  const statusColor =
    CONVERSATION_STATUS_COLORS[conversation.status] ?? CONVERSATION_STATUS_COLORS.ai_handling;
  const isAiHandling = conversation.status === 'ai_handling';
  const isHumanNeeded = conversation.status === 'human_needed';
  const isHumanHandling = conversation.status === 'human_handling';

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Status</p>
        <Badge className={statusColor}>{getStatusLabel(conversation.status)}</Badge>
      </div>

      {conversation.aiConfidenceScore != null && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">AI Confidence</p>
          <p className="text-sm font-medium">{Math.round(conversation.aiConfidenceScore * 100)}%</p>
        </div>
      )}

      {conversation.assignedTo && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Assigned Employee</p>
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            {conversation.assignedTo}
          </div>
        </div>
      )}

      {conversation.assignedTeam && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Team</p>
          <p className="text-sm">{conversation.assignedTeam}</p>
        </div>
      )}

      {conversation.hasFeedback && (
        <Badge variant="outline" className="gap-1">
          <Star className="h-3 w-3" />
          Feedback received
        </Badge>
      )}

      {conversation.awaitingFeedback && (
        <Badge variant="outline" className="gap-1 border-purple-500/30 text-purple-600">
          <Clock className="h-3 w-3" />
          Awaiting customer feedback
        </Badge>
      )}

      <Separator />

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Handoff Actions</p>

        {(isAiHandling || isHumanNeeded) && (
          <Button
            size="sm"
            className="w-full justify-start"
            onClick={() => takeover.mutate(conversationId)}
            disabled={takeover.isPending}
          >
            <UserCheck className="mr-2 h-4 w-4" />
            Take Over
          </Button>
        )}

        {(isHumanHandling || isHumanNeeded) && (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => returnToAi.mutate(conversationId)}
            disabled={returnToAi.isPending}
          >
            <Bot className="mr-2 h-4 w-4" />
            Return to AI
          </Button>
        )}

        {isAiHandling && (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => requestHuman.mutate(conversationId)}
            disabled={requestHuman.isPending}
          >
            <User className="mr-2 h-4 w-4" />
            Request Human
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={() => resolve.mutate(conversationId)}
          disabled={resolve.isPending || conversation.status === 'resolved'}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Mark Resolved
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={() => close.mutate(conversationId)}
          disabled={close.isPending || conversation.status === 'closed'}
        >
          <XCircle className="mr-2 h-4 w-4" />
          Close Conversation
        </Button>
      </div>

      <Separator />

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Assign / Transfer</p>
        <Select value={assigneeId} onValueChange={setAssigneeId}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select team member" />
          </SelectTrigger>
          <SelectContent>
            {teamMembers?.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name} ({member.role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={team} onValueChange={setTeam}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select team" />
          </SelectTrigger>
          <SelectContent>
            {TEAMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!assigneeId || assign.isPending}
            onClick={() =>
              assign.mutate({
                conversationId,
                assigneeId,
                team: team as 'SUPPORT' | 'SALES' | 'TECHNICAL' | 'GENERAL',
              })
            }
          >
            Assign
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={transfer.isPending}
            onClick={() =>
              transfer.mutate({
                conversationId,
                assigneeId: assigneeId || undefined,
                team: team as 'SUPPORT' | 'SALES' | 'TECHNICAL' | 'GENERAL',
              })
            }
          >
            <ArrowRightLeft className="mr-1 h-3 w-3" />
            Transfer
          </Button>
        </div>
      </div>

      <Separator />

      <div>
        <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
          <History className="h-3 w-3" />
          Activity Timeline
        </p>
        <ScrollArea className="h-48 pr-2">
          {activityLoading ? (
            <p className="text-xs text-muted-foreground">Loading activity…</p>
          ) : activity?.length ? (
            <ul className="space-y-3">
              {activity.map((item) => (
                <li key={item.id} className="border-l-2 border-muted pl-3">
                  <p className="text-sm font-medium leading-snug">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  )}
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatRelativeTime(item.createdAt)}
                    {item.actorUser
                      ? ` · ${item.actorUser.firstName} ${item.actorUser.lastName}`
                      : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No activity logged yet.</p>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
