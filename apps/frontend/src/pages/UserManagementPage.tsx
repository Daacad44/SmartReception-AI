import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Search, Shield, Key, UserX } from 'lucide-react';
import api, { extractData } from '@/lib/api';
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
import { LoadingState } from '@/components/LoadingState';
import { toast } from 'sonner';

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  totpEnabled: boolean;
  lastLoginAt?: string;
  businessMemberships: Array<{ role: string; business: { name: string } }>;
}

export function UserManagementPage() {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [form, setForm] = useState({
    email: '', password: '', firstName: '', lastName: '', isSuperAdmin: false,
  });
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['super-admin', 'users', search],
    queryFn: async () => {
      const res = await api.get('/super-admin/users', { params: { limit: 50, search: search || undefined } });
      return extractData<UserRow[]>(res);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => api.post('/super-admin/users', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'users'] });
      setCreateOpen(false);
      toast.success('User created');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch(`/super-admin/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'users'] });
      toast.success('User updated');
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => api.post(`/super-admin/users/${resetUserId}/reset-password`, { password: newPassword }),
    onSuccess: () => {
      setResetUserId(null);
      setNewPassword('');
      toast.success('Password reset');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Users className="h-6 w-6 text-accent" />
            User Management
          </h1>
          <p className="text-sm text-muted-foreground">Manage platform users, roles, and permissions.</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All Users</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <LoadingState rows={5} /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>2FA</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="font-medium">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                      {u.isSuperAdmin && <Badge className="mt-1 bg-navy">Super Admin</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {u.isSuperAdmin ? 'Super Admin' : u.businessMemberships[0]?.role ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">{u.businessMemberships[0]?.business.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={u.totpEnabled ? 'default' : 'secondary'}>{u.totpEnabled ? 'On' : 'Off'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? 'default' : 'secondary'}>{u.isActive ? 'Active' : 'Disabled'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Reset password" onClick={() => setResetUserId(u.id)}>
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={u.isActive ? 'Disable' : 'Enable'}
                          onClick={() => updateMutation.mutate({ id: u.id, data: { isActive: !u.isActive } })}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                        {u.isSuperAdmin && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Super admin">
                            <Shield className="h-4 w-4 text-accent" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isSuperAdmin"
                checked={form.isSuperAdmin}
                onChange={(e) => setForm({ ...form, isSuperAdmin: e.target.checked })}
              />
              <Label htmlFor="isSuperAdmin">Super Admin</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetUserId} onOpenChange={() => setResetUserId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <Input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <DialogFooter>
            <Button onClick={() => resetMutation.mutate()} disabled={newPassword.length < 8}>Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
