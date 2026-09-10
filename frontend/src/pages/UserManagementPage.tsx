import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Search, Key, UserX, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import type { PaginationMeta } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { toast } from 'sonner';

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  totpEnabled: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  approvalStatus?: string;
  businessMemberships: Array<{ role: string; isActive?: boolean; business: { id: string; name: string } }>;
}

const BUSINESS_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'AGENT', 'VIEWER', 'RECEPTIONIST', 'STAFF'];

function formatDate(value?: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleString();
}

export function UserManagementPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [businessId, setBusinessId] = useState('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsUserId, setDetailsUserId] = useState<string | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    isSuperAdmin: false,
    businessId: '',
    role: 'AGENT',
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['super-admin', 'users', search, page, role, status, businessId],
    queryFn: async () => {
      const res = await api.get('/super-admin/users', {
        params: {
          page,
          limit: 20,
          search: search || undefined,
          role: role === 'ALL' ? undefined : role,
          isActive: status === 'ALL' ? undefined : status === 'ACTIVE',
          businessId: businessId === 'ALL' ? undefined : businessId,
        },
      });
      return {
        users: extractData<UserRow[]>(res),
        meta: (res.data.meta ?? { page: 1, limit: 20, total: 0, totalPages: 1 }) as PaginationMeta,
      };
    },
  });

  const { data: businesses } = useQuery({
    queryKey: ['super-admin', 'businesses', 'user-filter'],
    queryFn: async () => {
      const res = await api.get('/super-admin/businesses', { params: { limit: 100 } });
      return extractData<Array<{ id: string; name: string }>>(res);
    },
  });

  const { data: userDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['super-admin', 'user', detailsUserId],
    queryFn: async () => {
      const res = await api.get(`/super-admin/users/${detailsUserId}`);
      return extractData<UserRow>(res);
    },
    enabled: Boolean(detailsUserId),
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post('/super-admin/users', {
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        isSuperAdmin: form.isSuperAdmin,
        businessId: form.businessId || undefined,
        role: form.businessId ? form.role : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'users'] });
      setCreateOpen(false);
      setForm({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        isSuperAdmin: false,
        businessId: '',
        role: 'AGENT',
      });
      toast.success('User created');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch(`/super-admin/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'user'] });
      toast.success('User updated');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => api.post(`/super-admin/users/${resetUserId}/reset-password`, { password: newPassword }),
    onSuccess: () => {
      setResetUserId(null);
      setNewPassword('');
      toast.success('Password reset');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const users = data?.users ?? [];
  const meta = data?.meta;
  const canPrev = page > 1;
  const canNext = Boolean(meta && page < meta.totalPages);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Users className="h-6 w-6 text-accent" />
            User Management
          </h1>
          <p className="text-sm text-muted-foreground">Manage platform users, roles, and workspace membership.</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search users..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Select
          value={role}
          onValueChange={(value) => {
            setRole(value);
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            {BUSINESS_ROLES.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="DISABLED">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Select
        value={businessId}
        onValueChange={(value) => {
          setBusinessId(value);
          setPage(1);
        }}
      >
        <SelectTrigger className="max-w-sm">
          <SelectValue placeholder="Business" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All businesses</SelectItem>
          {businesses?.map((business) => (
            <SelectItem key={business.id} value={business.id}>
              {business.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Card>
        <CardHeader><CardTitle className="text-base">Users</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isError ? (
            <ErrorState message="Unable to load users." onRetry={() => refetch()} />
          ) : isLoading ? (
            <LoadingState rows={5} />
          ) : !users.length ? (
            <EmptyState title="No users found" description="Try another search or create a user." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="font-medium">{u.firstName} {u.lastName}</p>
                      {u.isSuperAdmin && <Badge className="mt-1 bg-navy">Super Admin</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell className="text-sm">
                      {u.isSuperAdmin ? 'Super Admin' : u.businessMemberships[0]?.role ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">{u.businessMemberships[0]?.business.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? 'default' : 'secondary'}>{u.isActive ? 'Active' : 'Disabled'}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(u.lastLoginAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="View details" onClick={() => setDetailsUserId(u.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Reset password" onClick={() => setResetUserId(u.id)}>
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={u.isActive ? 'Deactivate' : 'Reactivate'}
                          onClick={() => updateMutation.mutate({ id: u.id, data: { isActive: !u.isActive } })}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={!canPrev} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={!canNext} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {[
              ['email', 'Email'],
              ['password', 'Password'],
              ['firstName', 'First Name'],
              ['lastName', 'Last Name'],
            ].map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  type={key === 'password' ? 'password' : 'text'}
                  value={form[key as keyof typeof form] as string}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="space-y-1">
              <Label>Business assignment</Label>
              <Select value={form.businessId || 'NONE'} onValueChange={(value) => setForm({ ...form, businessId: value === 'NONE' ? '' : value })}>
                <SelectTrigger>
                  <SelectValue placeholder="No business" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No business</SelectItem>
                  {businesses?.map((business) => (
                    <SelectItem key={business.id} value={business.id}>{business.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.businessId && (
              <div className="space-y-1">
                <Label>Workspace role</Label>
                <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_ROLES.map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isSuperAdmin"
                checked={form.isSuperAdmin}
                onChange={(e) => setForm({ ...form, isSuperAdmin: e.target.checked })}
              />
              <Label htmlFor="isSuperAdmin">Platform Super Admin</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetUserId} onOpenChange={() => setResetUserId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <Input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <DialogFooter>
            <Button onClick={() => resetMutation.mutate()} disabled={newPassword.length < 8 || resetMutation.isPending}>Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsUserId} onOpenChange={() => setDetailsUserId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>User details</DialogTitle></DialogHeader>
          {detailsLoading || !userDetails ? (
            <LoadingState rows={4} />
          ) : (
            <div className="space-y-3 text-sm">
              <p><strong>Name:</strong> {userDetails.firstName} {userDetails.lastName}</p>
              <p><strong>Email:</strong> {userDetails.email}</p>
              <p><strong>Status:</strong> {userDetails.isActive ? 'Active' : 'Disabled'}</p>
              <p><strong>Approval:</strong> {userDetails.approvalStatus ?? '—'}</p>
              <p><strong>Platform access:</strong> {userDetails.isSuperAdmin ? 'Super Admin' : 'Standard'}</p>
              <p><strong>Last login:</strong> {formatDate(userDetails.lastLoginAt)}</p>
              <div>
                <p className="mb-1 font-medium">Workspaces</p>
                {userDetails.businessMemberships.length ? (
                  <ul className="space-y-1">
                    {userDetails.businessMemberships.map((membership) => (
                      <li key={`${membership.business.id}-${membership.role}`}>
                        {membership.business.name} — {membership.role}
                        {membership.isActive === false ? ' (inactive)' : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No workspace memberships.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
