import { Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/lib/entities';

interface ConversationModeToggleProps {
  conversation: Conversation;
  conversationId: string;
  onTakeover: () => void;
  onReturnToAi: () => void;
  takeoverPending?: boolean;
  returnPending?: boolean;
  disabled?: boolean;
}

export function ConversationModeToggle({
  conversation,
  onTakeover,
  onReturnToAi,
  takeoverPending,
  returnPending,
  disabled,
}: ConversationModeToggleProps) {
  const isHumanMode =
    conversation.status === 'human_handling' ||
    conversation.status === 'human_needed' ||
    conversation.status === 'escalated' ||
    conversation.status === 'transferred';

  return (
    <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
      <Button
        type="button"
        size="sm"
        variant={!isHumanMode ? 'default' : 'ghost'}
        className={cn(
          'h-8 gap-1.5 rounded-md px-2 text-xs sm:px-3',
          !isHumanMode && 'bg-accent text-white hover:bg-accent/90'
        )}
        disabled={disabled || takeoverPending || returnPending || !isHumanMode}
        onClick={onReturnToAi}
        aria-label="AI"
      >
        <Bot className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">AI</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant={isHumanMode ? 'default' : 'ghost'}
        className={cn(
          'h-8 gap-1.5 rounded-md px-2 text-xs sm:px-3',
          isHumanMode && 'bg-accent text-white hover:bg-accent/90'
        )}
        disabled={disabled || takeoverPending || returnPending || (isHumanMode && conversation.status === 'human_handling')}
        onClick={() => {
          if (conversation.status === 'human_needed') {
            onTakeover();
            return;
          }
          if (!isHumanMode) onTakeover();
        }}
        aria-label="Human"
      >
        <User className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Human</span>
      </Button>
    </div>
  );
}
