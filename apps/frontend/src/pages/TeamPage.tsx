import { useState } from 'react';
import { Plus, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTeamMembers } from '@/hooks/useApi';
import { useInviteTeamMember, useRemoveTeamMember } from '@/hooks/useMutations';
import { getInitials } from '@/lib/utils';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

const roleColors: Record<string, string> = {
  OWNER: 'bg-accent/10 text-accent',
  ADMIN: 'bg-primary/10 text-primary',
  MANAGER: 'bg-warning/10 text-warning',
  AGENT: 'bg-success/10 text-success',
};

export function TeamPage() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'AGENT' });

  const { data: members, isLoading, isError } = useTeamMembers();
  const inviteMember = useInviteTeamMember();
  const removeMember = useRemoveTeamMember();

  const handleInvite = async () => {
    if (!inviteForm.email.trim()) return;
    await inviteMember.mutateAsync(inviteForm);
    setInviteForm({ email: '', role: 'AGENT' });
    setInviteOpen(false);
  };

  if (isError) {
    return <ErrorState message="Unable to load team members." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-muted-foreground">Manage team members and their roles</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90" onClick={() => setInviteOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      {isLoading ? (
        <LoadingState rows={3} />
      ) : !members?.length ? (
        <EmptyState
          title="No team members"
          description="Invite colleagues to collaborate on customer conversations."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {members.map((member) => (
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
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => removeMember.mutate(member.id)}
                      >
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-navy text-white text-lg">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your business workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="colleague@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(role) => setInviteForm({ ...inviteForm, role })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="AGENT">Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button
              className="bg-accent hover:bg-accent/90"
              onClick={handleInvite}
              disabled={inviteMember.isPending}
            >
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
