import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Search, MoreHorizontal, Pause, Play, Trash2 } from 'lucide-react';
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingState } from '@/components/LoadingState';
import { toast } from 'sonner';

interface BusinessRow {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  plan: string;
  whatsappNumber?: string;
  activeCustomers: number;
  owner?: { firstName: string; lastName: string; email: string };
}

export function BusinessManagementPage() {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', ownerEmail: '', ownerFirstName: '', ownerLastName: '', ownerPassword: '', plan: 'STARTER', phone: '',
  });
  const queryClient = useQueryClient();

  const { data: businesses, isLoading } = useQuery({
    queryKey: ['super-admin', 'businesses', search],
    queryFn: async () => {
      const res = await api.get('/super-admin/businesses', { params: { limit: 50, search: search || undefined } });
      return extractData<BusinessRow[]>(res);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => api.post('/super-admin/businesses', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'businesses'] });
      setCreateOpen(false);
      toast.success('Business created');
    },
    onError: () => toast.error('Failed to create business'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/super-admin/businesses/${id}/status`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'businesses'] });
      toast.success('Business updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/super-admin/businesses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'businesses'] });
      toast.success('Business deleted');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Building2 className="h-6 w-6 text-accent" />
            Business Management
          </h1>
          <p className="text-sm text-muted-foreground">Create, edit, and manage all platform businesses.</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Business
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search businesses..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All Businesses</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <LoadingState rows={5} /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Customers</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {businesses?.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.slug}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {b.owner ? `${b.owner.firstName} ${b.owner.lastName}` : '—'}
                      {b.owner && <p className="text-xs text-muted-foreground">{b.owner.email}</p>}
                    </TableCell>
                    <TableCell className="text-sm">{b.whatsappNumber || '—'}</TableCell>
                    <TableCell><Badge variant="secondary">{b.plan}</Badge></TableCell>
                    <TableCell>{b.activeCustomers}</TableCell>
                    <TableCell>
                      <Badge variant={b.isActive ? 'default' : 'secondary'}>{b.isActive ? 'Active' : 'Suspended'}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toggleMutation.mutate({ id: b.id, isActive: !b.isActive })}>
                            {b.isActive ? <><Pause className="mr-2 h-4 w-4" />Suspend</> : <><Play className="mr-2 h-4 w-4" />Activate</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(b.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
          <DialogHeader><DialogTitle>Create Business</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {[
              ['name', 'Business Name'],
              ['ownerEmail', 'Owner Email'],
              ['ownerFirstName', 'Owner First Name'],
              ['ownerLastName', 'Owner Last Name'],
              ['ownerPassword', 'Owner Password'],
              ['phone', 'WhatsApp / Phone'],
            ].map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  type={key === 'ownerPassword' ? 'password' : 'text'}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
