import { Plus, MoreHorizontal, Mail, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTeamMembers } from '@/hooks/useApi';
import { getInitials } from '@/lib/utils';

const roleColors: Record<string, string> = {
  OWNER: 'bg-accent/10 text-accent',
  ADMIN: 'bg-primary/10 text-primary',
  MANAGER: 'bg-warning/10 text-warning',
  AGENT: 'bg-success/10 text-success',
};

const statusDot: Record<string, string> = {
  online: 'bg-success',
  away: 'bg-warning',
  offline: 'bg-muted-foreground',
};

export function TeamPage() {
  const { data: members } = useTeamMembers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-muted-foreground">Manage team members and their roles</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90">
          <Plus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {members?.map((member) => (
          <Card key={member.id} className="relative">
            <CardContent className="p-6">
              <div className="absolute right-4 top-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Edit Role</DropdownMenuItem>
                    <DropdownMenuItem>View Activity</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">Remove</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-navy text-white text-lg">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${statusDot[member.status]}`}
                  />
                </div>
                <h3 className="mt-3 font-semibold">{member.name}</h3>
                <p className="text-sm text-muted-foreground">{member.email}</p>
                <Badge className={`mt-2 text-[10px] ${roleColors[member.role] ?? ''}`}>
                  {member.role}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4">
                <div className="text-center">
                  <p className="text-lg font-bold">{member.conversationsHandled}</p>
                  <p className="text-[10px] text-muted-foreground">Conversations</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{member.avgResponseTime}</p>
                  <p className="text-[10px] text-muted-foreground">Avg Response</p>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Mail className="mr-1 h-3 w-3" />
                  Email
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <MessageSquare className="mr-1 h-3 w-3" />
                  Chat
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
