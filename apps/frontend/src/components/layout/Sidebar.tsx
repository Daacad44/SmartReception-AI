import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Calendar,
  BookOpen,
  BarChart3,
  UsersRound,
  Settings,
  CreditCard,
  Bot,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useConversations, useBilling, useAppointments } from '@/hooks/useApi';
import { usePermissions } from '@/hooks/usePermissions';
import { ROUTE_PERMISSIONS } from '@/lib/permissions';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/conversations', icon: MessageSquare, label: 'Conversations', badgeKey: 'conversations' as const },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/appointments', icon: Calendar, label: 'Appointments', badgeKey: 'appointments' as const },
  { to: '/knowledge', icon: BookOpen, label: 'Knowledge Base' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/team', icon: UsersRound, label: 'Team' },
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/billing', icon: CreditCard, label: 'Billing' },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { data: conversations } = useConversations();
  const { data: appointments } = useAppointments();
  const { data: billing } = useBilling();
  const { hasPermission } = usePermissions();
  const unreadCount = conversations?.reduce((sum, c) => sum + c.unreadCount, 0) ?? 0;
  const upcomingAppointments =
    appointments?.filter((a) => a.status !== 'cancelled' && a.status !== 'completed').length ?? 0;

  const conversationUsage = billing?.usage?.conversations;
  const usagePercent =
    conversationUsage && conversationUsage.limit > 0
      ? Math.round((conversationUsage.used / conversationUsage.limit) * 100)
      : 0;

  const badges: Record<string, number> = {
    conversations: unreadCount,
    appointments: upcomingAppointments,
  };

  const visibleItems = navItems.filter((item) => {
    const permission = ROUTE_PERMISSIONS[item.to];
    return permission ? hasPermission(permission) : true;
  });

  return (
    <aside className="flex h-full w-64 flex-col bg-navy text-white">
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight">SmartReception</h1>
          <p className="text-xs text-white/60">AI Platform</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.badgeKey && badges[item.badgeKey] > 0 && (
              <Badge className="bg-accent text-white hover:bg-accent/90 h-5 min-w-5 justify-center px-1.5 text-[10px]">
                {badges[item.badgeKey]}
              </Badge>
            )}
          </NavLink>
        ))}
      </nav>

      {hasPermission('billing:read') && (
        <div className="border-t border-white/10 p-4">
          <div className="rounded-lg bg-white/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-xs font-semibold">{billing?.plan ?? 'Starter'} Plan</span>
            </div>
            <p className="mb-3 text-[11px] text-white/50">
              {conversationUsage
                ? `${conversationUsage.used.toLocaleString()} / ${conversationUsage.limit.toLocaleString()} conversations`
                : 'Loading usage...'}
            </p>
            <Progress value={usagePercent} className="mb-3 h-1.5 bg-white/10" />
            <Link
              to="/billing"
              onClick={onNavigate}
              className="block text-center text-xs font-medium text-accent hover:text-accent/80"
            >
              Upgrade Plan
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}
