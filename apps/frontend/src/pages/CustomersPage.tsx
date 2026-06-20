import { useState } from 'react';
import { Search, Plus, MoreHorizontal, Mail, Phone, Tag, Activity } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useCustomers,
  useCustomerTags,
  useCustomerNotes,
  useCustomerTimeline,
  useCustomerInsights,
} from '@/hooks/useApi';
import {
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useAddCustomerNote,
  useAssignCustomerTags,
  useCreateCustomerTag,
} from '@/hooks/useMutations';
import { getInitials, formatRelativeTime } from '@/lib/utils';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import type { Customer } from '@/lib/entities';

const statusVariant: Record<string, 'success' | 'warning' | 'accent' | 'secondary'> = {
  active: 'success',
  vip: 'accent',
  inactive: 'secondary',
};

export function CustomersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [tagFilter, setTagFilter] = useState<string>('All');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [newNote, setNewNote] = useState('');
  const [newTagName, setNewTagName] = useState('');

  const { data: customers, isLoading, isError } = useCustomers(search);
  const { data: tags } = useCustomerTags();
  const { data: notes } = useCustomerNotes(detailCustomer?.id ?? null);
  const { data: timeline } = useCustomerTimeline(detailCustomer?.id ?? null);
  const { data: insights } = useCustomerInsights(detailCustomer?.id ?? null);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const addNote = useAddCustomerNote();
  const assignTags = useAssignCustomerTags();
  const createTag = useCreateCustomerTag();

  const filtered = customers?.filter((c) => {
    if (statusFilter === 'VIP' && c.status !== 'vip') return false;
    if (statusFilter === 'Active' && c.status !== 'active') return false;
    if (statusFilter === 'Inactive' && c.status !== 'inactive') return false;
    if (tagFilter !== 'All' && !c.tags.includes(tagFilter)) return false;
    return true;
  });

  const openCreate = () => {
    setEditingCustomer(null);
    setForm({ name: '', phone: '', email: '', notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? '',
      notes: '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    if (editingCustomer) {
      await updateCustomer.mutateAsync({
        id: editingCustomer.id,
        data: {
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          notes: form.notes || undefined,
        },
      });
    } else {
      await createCustomer.mutateAsync({
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        notes: form.notes || undefined,
      });
    }
    setDialogOpen(false);
  };

  const toggleTag = (tagId: string) => {
    if (!detailCustomer) return;
    const current = insights?.tags.map((t) => t.id) ?? [];
    const next = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    assignTags.mutate({ customerId: detailCustomer.id, tagIds: next });
  };

  if (isError) {
    return <ErrorState message="Unable to load customers." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage your customer database, notes, and tags</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90 w-full sm:w-auto" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {['All', 'VIP', 'Active', 'Inactive'].map((tag) => (
            <Button
              key={tag}
              variant={statusFilter === tag ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(tag)}
            >
              {tag}
            </Button>
          ))}
        </div>
        {tags && tags.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant={tagFilter === 'All' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTagFilter('All')}
            >
              All Tags
            </Button>
            {tags.map((t) => (
              <Button
                key={t.id}
                variant={tagFilter === t.name ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTagFilter(t.name)}
              >
                {t.name}
              </Button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <LoadingState rows={5} />
      ) : !filtered?.length ? (
        <EmptyState
          title="No customers yet"
          description="Add your first customer to start managing relationships."
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Conversations</TableHead>
                <TableHead>Last Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer"
                  onClick={() => setDetailCustomer(customer)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-accent/10 text-accent text-xs">
                          {getInitials(customer.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Since {new Date(customer.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {customer.phone}
                      </div>
                      {customer.email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {customer.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {customer.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{customer.totalConversations}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRelativeTime(customer.lastContact)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[customer.status]} className="capitalize text-[10px]">
                      {customer.status}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(customer)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteCustomer.mutate(customer.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={!!detailCustomer} onOpenChange={(open) => !open && setDetailCustomer(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detailCustomer && (
            <>
              <SheetHeader>
                <SheetTitle>{detailCustomer.name}</SheetTitle>
                <SheetDescription>{detailCustomer.phone}</SheetDescription>
              </SheetHeader>

              {insights && (
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border p-2">
                    <p className="text-lg font-bold">{insights.leadScore}</p>
                    <p className="text-[10px] text-muted-foreground">Lead Score</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-lg font-bold">{insights.totalAppointments}</p>
                    <p className="text-[10px] text-muted-foreground">Appointments</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-lg font-bold">{insights.totalMessages}</p>
                    <p className="text-[10px] text-muted-foreground">Messages</p>
                  </div>
                </div>
              )}

              <Tabs defaultValue="notes" className="mt-6">
                <TabsList className="w-full">
                  <TabsTrigger value="notes" className="flex-1">Notes</TabsTrigger>
                  <TabsTrigger value="tags" className="flex-1">Tags</TabsTrigger>
                  <TabsTrigger value="timeline" className="flex-1">Timeline</TabsTrigger>
                </TabsList>

                <TabsContent value="notes" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Add a note..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={2}
                    />
                    <Button
                      size="sm"
                      disabled={!newNote.trim() || addNote.isPending}
                      onClick={() => {
                        addNote.mutate(
                          { customerId: detailCustomer.id, content: newNote.trim() },
                          { onSuccess: () => setNewNote('') }
                        );
                      }}
                    >
                      Add Note
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {notes?.map((n) => (
                      <div key={n.id} className="rounded-lg border p-3 text-sm">
                        <p>{n.content}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatRelativeTime(n.createdAt)}
                        </p>
                      </div>
                    ))}
                    {!notes?.length && (
                      <p className="text-sm text-muted-foreground">No notes yet</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="tags" className="space-y-4 mt-4">
                  <div className="flex flex-wrap gap-2">
                    {tags?.map((t) => {
                      const active = insights?.tags.some((it) => it.id === t.id);
                      return (
                        <Badge
                          key={t.id}
                          variant={active ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => toggleTag(t.id)}
                        >
                          <Tag className="h-3 w-3 mr-1" />
                          {t.name}
                        </Badge>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="New tag name"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                    />
                    <Button
                      size="sm"
                      disabled={!newTagName.trim()}
                      onClick={() => {
                        createTag.mutate(
                          { name: newTagName.trim() },
                          { onSuccess: () => setNewTagName('') }
                        );
                      }}
                    >
                      Create
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="timeline" className="space-y-3 mt-4">
                  {timeline?.map((event) => (
                    <div key={event.id} className="flex gap-3 border-l-2 border-accent/30 pl-3">
                      <Activity className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{event.title}</p>
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatRelativeTime(event.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!timeline?.length && (
                    <p className="text-sm text-muted-foreground">No activity yet</p>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
            <DialogDescription>
              {editingCustomer ? 'Update customer details.' : 'Create a new customer record.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-accent hover:bg-accent/90"
              onClick={handleSubmit}
              disabled={createCustomer.isPending || updateCustomer.isPending}
            >
              {editingCustomer ? 'Save Changes' : 'Create Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
