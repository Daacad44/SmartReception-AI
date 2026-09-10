import { useMemo, useState } from 'react';
import { MoreHorizontal, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useTeamInvitations, useTeamMembers } from '@/hooks/useApi';
import {
  useInviteTeamMember,
  useRemoveTeamMember,
  useResendInvitation,
  useRevokeInvitation,
  useUpdateTeamMember,
} from '@/hooks/useMutations';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/stores/auth.store';

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'AGENT', label: 'Agent' },
  { value: 'RECEPTIONIST', label: 'Receptionist' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'VIEWER', label: 'Viewer' },
] as const;

const ROLE_RANK: Record<string, number> = {
  VIEWER: 0,
  STAFF: 1,
  RECEPTIONIST: 2,
  AGENT: 3,
  MANAGER: 4,
  ADMIN: 5,
  OWNER: 6,
};

function assignableRoles(actorRole: string) {
  if (actorRole === 'OWNER') return ROLE_OPTIONS;
  if (actorRole === 'ADMIN') {
    return ROLE_OPTIONS.filter((role) => (ROLE_RANK[role.value] ?? 99) < ROLE_RANK.ADMIN);
  }
  return [];
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

function statusLabel(status: string) {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'ACCEPTED':
      return 'Accepted';
    case 'EXPIRED':
      return 'Expired';
    case 'REVOKED':
      return 'Revoked';
    default:
      return status;
  }
}

export function TeamPage() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'AGENT' });
  const [memberSearch, setMemberSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const { role, hasPermission } = usePermissions();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const canManage = hasPermission('team:write');
  const roles = assignableRoles(role);

  const { data: members, isLoading, isError, refetch } = useTeamMembers();
  const {
    data: invitations,
    isLoading: invitationsLoading,
    isError: invitationsError,
    refetch: refetchInvitations,
  } = useTeamInvitations();
  const inviteMember = useInviteTeamMember();
  const removeMember = useRemoveTeamMember();
  const updateMember = useUpdateTeamMember();
  const resendInvitation = useResendInvitation();
  const revokeInvitation = useRevokeInvitation();

  const visibleMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    return (members ?? []).filter((member) => {
      const matchesSearch =
        !query ||
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query);
      const matchesRole = roleFilter === 'ALL' || member.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [members, memberSearch, roleFilter]);

  const pendingInvitations = (invitations ?? []).filter((invitation) => invitation.status === 'PENDING');
  const otherInvitations = (invitations ?? []).filter((invitation) => invitation.status !== 'PENDING');

  const handleInvite = async () => {
    if (!inviteForm.email.trim()) return;
    try {
      await inviteMember.mutateAsync(inviteForm);
      setInviteForm({ email: '', role: roles[0]?.value ?? 'AGENT' });
      setInviteOpen(false);
    } catch {
      // Error toast is handled by the mutation.
    }
  };

  if (isError) {
    return (
      <ErrorState
        title="We couldn't load your team"
        message="Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team Members</h1>
          <p className="text-muted-foreground">Manage members, roles, and invitations for this workspace.</p>
        </div>
        {canManage && (
          <Button className="bg-accent hover:bg-accent/90" onClick={() => setInviteOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or email"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            {['OWNER', ...ROLE_OPTIONS.map((r) => r.value)].map((value) => (
              <SelectItem key={value} value={value}>
                {value.charAt(0) + value.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <LoadingState rows={4} />
              <p className="mt-3 text-center text-sm text-muted-foreground">Loading team members...</p>
            </div>
          ) : !visibleMembers.length ? (
            <EmptyState
              title="No team members yet."
              description="Invite your first team member to start collaborating."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleMembers.map((member) => {
                  const isSelf = member.userId === currentUserId;
                  const isOwner = member.role === 'OWNER';
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{member.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.isActive === false ? 'secondary' : 'default'}>
                          {member.isActive === false ? 'Inactive' : 'Active'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(member.joinedAt)}</TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          {!isOwner && !isSelf && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Member actions">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {roles.map((option) => (
                                  <DropdownMenuItem
                                    key={option.value}
                                    disabled={option.value === member.role}
                                    onClick={() => updateMember.mutate({ memberId: member.id, role: option.value })}
                                  >
                                    Change role to {option.label}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => removeMember.mutate(member.id)}
                                >
                                  Remove member
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {invitationsError ? (
            <ErrorState message="Unable to load invitations." onRetry={() => refetchInvitations()} />
          ) : invitationsLoading ? (
            <div className="p-6">
              <LoadingState rows={3} />
            </div>
          ) : !pendingInvitations.length ? (
            <EmptyState title="No pending invitations." description="Sent invitations will appear here until they are accepted, expired, or revoked." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>{invitation.role}</TableCell>
                    <TableCell>{invitation.invitedBy ?? '—'}</TableCell>
                    <TableCell>{formatDate(invitation.createdAt)}</TableCell>
                    <TableCell>{formatDate(invitation.expiresAt)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{statusLabel(invitation.status)}</Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={resendInvitation.isPending}
                          onClick={() => resendInvitation.mutate(invitation.id)}
                        >
                          Resend
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={revokeInvitation.isPending}
                          onClick={() => revokeInvitation.mutate(invitation.id)}
                        >
                          Revoke
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {otherInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invitation History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {otherInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>{invitation.role}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{statusLabel(invitation.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      {formatDate(invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
            <DialogDescription>Send a secure invitation to join this workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="employee@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(nextRole) => setInviteForm({ ...inviteForm, role: nextRole })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-accent hover:bg-accent/90"
              onClick={handleInvite}
              disabled={inviteMember.isPending || !inviteForm.email.trim() || !roles.length}
            >
              {inviteMember.isPending ? 'Sending invitation...' : 'Send invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
