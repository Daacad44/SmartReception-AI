import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, ChevronDown, Building2, LogOut, User, Settings, Moon, Sun, Menu, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useBusiness } from '@/hooks/useBusiness';
import { useNotifications, useMarkNotificationRead } from '@/hooks/useApi';
import type { Notification } from '@/lib/entities';
import { useTheme } from '@/components/ThemeProvider';
import { getInitials, formatRelativeTime } from '@/lib/utils';
import { InstallButton } from '@/pwa';

const QUICK_LINKS = [
  { label: 'Conversations', path: '/conversations' },
  { label: 'Customers', path: '/customers' },
  { label: 'Appointments', path: '/appointments' },
  { label: 'Campaign Center', path: '/campaigns' },
  { label: 'Knowledge Base', path: '/ai-training' },
];

interface TopBarProps {
  onMenuClick?: () => void;
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
}

export function TopBar({ onMenuClick, sidebarCollapsed, onSidebarToggle }: TopBarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { businesses, currentBusiness, switchBusiness } = useBusiness();
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const { resolvedTheme, setTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const unreadNotifications = notifications?.filter((n) => !n.read).length ?? 0;
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'User';

  const filteredLinks = QUICK_LINKS.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.read) {
      markRead.mutate(notif.id);
    }

    const data = notif.data as Record<string, string> | null | undefined;
    if (data?.conversationId) {
      navigate(`/conversations?conversation=${data.conversationId}`);
      return;
    }
    if (data?.appointmentId) {
      navigate('/appointments');
      return;
    }
    if (data?.documentId) {
      navigate('/knowledge');
      return;
    }
    if (data?.campaignId) {
      navigate('/campaigns');
      return;
    }
    if (notif.title.toLowerCase().includes('subscription') || notif.title.toLowerCase().includes('invoice')) {
      navigate('/billing');
    }
  };

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-card px-4 md:px-6">
      {onMenuClick && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 md:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {onSidebarToggle && (
        <Button
          variant="ghost"
          size="icon"
          className="hidden shrink-0 md:flex"
          onClick={onSidebarToggle}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search... (⌘K)"
              className="bg-background pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" sideOffset={8}>
          <div className="border-b p-2">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Quick navigation</p>
          </div>
          <div className="max-h-64 overflow-y-auto p-1 scrollbar-thin">
            {(filteredLinks.length ? filteredLinks : QUICK_LINKS).map((item) => (
              <button
                key={item.path}
                type="button"
                className="flex w-full items-center rounded-md px-3 py-2 text-sm hover:bg-accent/10"
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <InstallButton className="hidden lg:inline-flex" />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-white">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={8}
            className="w-[min(100vw-2rem,22rem)] p-0"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-semibold">Notifications</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-accent"
                onClick={() => navigate('/notifications')}
              >
                View all
              </Button>
            </div>
            <ScrollArea className="max-h-[min(60vh,320px)]">
              {!notifications?.length ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications</p>
              ) : (
                <div className="divide-y">
                  {notifications.slice(0, 20).map((notif) => (
                    <button
                      key={notif.id}
                      type="button"
                      className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-accent/5"
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="text-sm font-medium">{notif.title}</span>
                        {!notif.read && <Badge variant="accent" className="shrink-0 text-[10px]">New</Badge>}
                      </div>
                      <span className="line-clamp-2 text-xs text-muted-foreground">{notif.message}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="hidden gap-2 sm:flex">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="max-w-[120px] truncate text-sm lg:max-w-[140px]">
                {currentBusiness?.name ?? 'Select Business'}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-56">
            <DropdownMenuLabel>Switch Business</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {businesses.map((biz) => (
              <DropdownMenuItem
                key={biz.id}
                onClick={() => switchBusiness(biz.id)}
                className={currentBusiness?.id === biz.id ? 'bg-accent/10' : ''}
              >
                <Building2 className="mr-2 h-4 w-4" />
                <div>
                  <p className="text-sm">{biz.name}</p>
                  <p className="text-xs text-muted-foreground">{biz.plan}</p>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-accent text-xs text-white">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                <p className="text-xs text-muted-foreground">{user?.role}</p>
              </div>
              <ChevronDown className="hidden h-4 w-4 opacity-50 md:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-48">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <User className="mr-2 h-4 w-4" />
              Profile & Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Preferences
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
