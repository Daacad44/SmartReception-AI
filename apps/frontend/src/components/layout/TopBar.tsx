import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, ChevronDown, Building2, LogOut, User, Settings, Moon, Sun, Menu } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useBusiness } from '@/hooks/useBusiness';
import { useNotifications, useMarkNotificationRead } from '@/hooks/useApi';
import type { Notification } from '@/lib/entities';
import { useTheme } from '@/components/ThemeProvider';
import { getInitials, formatRelativeTime } from '@/lib/utils';

const QUICK_LINKS = [
  { label: 'Conversations', path: '/conversations' },
  { label: 'Customers', path: '/customers' },
  { label: 'Appointments', path: '/appointments' },
  { label: 'Knowledge Base', path: '/knowledge' },
];

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { businesses, currentBusiness, switchBusiness } = useBusiness();
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const { resolvedTheme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);

  const unreadNotifications = notifications?.filter((n) => !n.read).length ?? 0;
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'User';

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
    if (notif.title.toLowerCase().includes('subscription') || notif.title.toLowerCase().includes('invoice')) {
      navigate('/billing');
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6 gap-3">
      {onMenuClick && (
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search... (⌘K)"
          className="bg-background pl-9"
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setSearchOpen(false)}
        />
        {searchOpen && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border bg-card p-4 shadow-lg">
            <p className="text-xs text-muted-foreground">Quick search</p>
            <div className="mt-2 space-y-1">
              {QUICK_LINKS.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    navigate(item.path);
                    setSearchOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-white">
                  {unreadNotifications}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 z-50" sideOffset={8}>
            <DropdownMenuLabel className="flex items-center justify-between">
              Notifications
              <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-accent" onClick={() => navigate('/notifications')}>
                View all
              </Button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="h-64">
              {notifications?.map((notif) => (
                <DropdownMenuItem
                  key={notif.id}
                  className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-sm font-medium">{notif.title}</span>
                    {!notif.read && <Badge variant="accent" className="text-[10px]">New</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">{notif.message}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(notif.createdAt)}
                  </span>
                </DropdownMenuItem>
              ))}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="max-w-[140px] truncate text-sm">
                {currentBusiness?.name ?? 'Select Business'}
              </span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
                <AvatarFallback className="bg-accent text-white text-xs">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                <p className="text-xs text-muted-foreground">{user?.role}</p>
              </div>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
