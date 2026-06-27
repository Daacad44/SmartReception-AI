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
  Bell,
  Shield,
  Sparkles,
  Building2,
  Megaphone,
  Crown,
  Upload,
  Radio,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useConversationSummary, useBilling, useAppointments } from '@/hooks/useApi';
import { usePermissions } from '@/hooks/usePermissions';
import { ROUTE_PERMISSIONS, PERMISSIONS } from '@/lib/permissions';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/conversations', icon: MessageSquare, label: 'Conversations', badgeKey: 'conversations' as const },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/customers/import', icon: Upload, label: 'Customer Import', permission: 'customers:write' as const },
  { to: '/appointments', icon: Calendar, label: 'Appointments', badgeKey: 'appointments' as const },
  { to: '/campaigns', icon: Megaphone, label: 'Campaign Center', permission: 'campaigns:read' as const },
  { to: '/employee-comms', icon: Radio, label: 'Employee Comms', permission: 'employee-comms:read' as const },
  { to: '/knowledge', icon: BookOpen, label: 'Knowledge Base' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/team', icon: UsersRound, label: 'Team' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/audit-logs', icon: Shield, label: 'Audit Logs', permission: 'audit:read' as const },
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/billing', icon: CreditCard, label: 'Billing' },
];

const adminNavItems = [
  { to: '/super-admin', icon: Crown, label: 'Super Admin', permission: 'platform:admin' as const },
  { to: '/admin/businesses', icon: Building2, label: 'Business Management', permission: 'platform:admin' as const },
  { to: '/admin/subscriptions', icon: CreditCard, label: 'Subscriptions', permission: 'platform:admin' as const },
  { to: '/admin/users', icon: UsersRound, label: 'User Management', permission: 'platform:admin' as const },
];

interface SidebarProps {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ onNavigate, collapsed = false, onToggleCollapse }: SidebarProps) {
  const { data: summary } = useConversationSummary();
  const { data: appointments } = useAppointments();
  const { data: billing } = useBilling();
  const { hasPermission } = usePermissions();
  const unreadCount = summary?.unreadTotal ?? 0;
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

  const visibleItems = [...navItems, ...adminNavItems].filter((item) => {
    const permission =
      'permission' in item && item.permission
        ? PERMISSIONS[item.permission]
        : ROUTE_PERMISSIONS[item.to];
    return permission ? hasPermission(permission) : true;
  });

  return (
    <aside
      className={cn(
        'flex h-full flex-col bg-navy text-white transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-[4.5rem]' : 'w-64'
      )}
    >
      <div
        className={cn(
          'flex items-center border-b border-white/10 py-5',
          collapsed ? 'justify-center px-2' : 'gap-3 px-6'
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent">
          <Bot className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold leading-tight">SmartReception</h1>
            <p className="text-xs text-white/60">AI Platform</p>
          </div>
        )}
        {onToggleCollapse && !collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      {onToggleCollapse && collapsed && (
        <div className="flex justify-center border-b border-white/10 py-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:bg-white/10 hover:text-white"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4 scrollbar-thin">
        {visibleItems.map((item) => {
          const linkContent = (
            <NavLink
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center rounded-lg text-sm font-medium transition-colors',
                  collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && 'badgeKey' in item && item.badgeKey && badges[item.badgeKey] > 0 && (
                <Badge className="h-5 min-w-5 justify-center bg-accent px-1.5 text-[10px] text-white hover:bg-accent/90">
                  {badges[item.badgeKey]}
                </Badge>
              )}
              {collapsed && 'badgeKey' in item && item.badgeKey && badges[item.badgeKey] > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
                  {badges[item.badgeKey] > 9 ? '9+' : badges[item.badgeKey]}
                </span>
              )}
            </NavLink>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.to} delayDuration={0}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                  {'badgeKey' in item && item.badgeKey && badges[item.badgeKey] > 0
                    ? ` (${badges[item.badgeKey]})`
                    : ''}
                </TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.to}>{linkContent}</div>;
        })}
      </nav>

      {hasPermission('billing:read') && !collapsed && (
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

      {hasPermission('billing:read') && collapsed && (
        <div className="border-t border-white/10 p-2">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link
                to="/billing"
                onClick={onNavigate}
                className="flex justify-center rounded-lg p-2 text-accent hover:bg-white/5"
              >
                <Sparkles className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{billing?.plan ?? 'Starter'} Plan</TooltipContent>
          </Tooltip>
        </div>
      )}
    </aside>
  );
}
