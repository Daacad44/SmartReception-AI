import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Send, Plus, FileText, Trash2, Pencil, MessageSquare,
  Sparkles, UsersRound, Radio, Upload, Download,
  Copy, Archive, UserPlus, MoreHorizontal,
} from 'lucide-react';
import api, { extractData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { EmployeeImportDialog } from '@/components/employee-comms/EmployeeImportDialog';
import { EmployeeProfileDialog, type EmployeeFormData } from '@/components/employee-comms/EmployeeProfileDialog';
import { RecipientBuilder, buildPayload, type RecipientAudience } from '@/components/employee-comms/RecipientBuilder';
import { toast } from 'sonner';
import { cn, getInitials } from '@/lib/utils';

const BROADCAST_TYPES = [
  'ANNOUNCEMENT', 'NOTIFICATION', 'EMERGENCY', 'MEETING', 'HOLIDAY', 'POLICY',
  'TRAINING', 'MOTIVATION', 'PAYROLL', 'SHIFT', 'CUSTOM',
];

interface Employee {
  id: string;
  fullName: string;
  jobTitle?: string;
  department?: string;
  branch?: string;
  phone: string;
  email?: string;
  status: string;
  employmentType: string;
  employeeCode?: string;
  whatsappNumber?: string;
  role?: string;
  notes?: string;
  emergencyContact?: string;
  tags?: string[];
  groupMembers?: Array<{ group: { id: string; name: string; color: string } }>;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  color: string;
  department?: string;
  isSystem: boolean;
  _count?: { members: number };
  members?: Array<{ employee: { id: string; fullName: string; department?: string; profilePhotoUrl?: string } }>;
}

interface Broadcast {
  id: string;
  name: string;
  message: string;
  type: string;
  status: string;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  readCount: number;
  isEmergency?: boolean;
  _count?: { recipients: number };
}

interface Template {
  id: string;
  name: string;
  content: string;
  category: string;
}

interface InboxConversation {
  id: string;
  unreadCount: number;
  employee: { id: string; fullName: string; phone: string; department?: string };
  messages?: Array<{ id?: string; content: string; direction: string; createdAt: string }>;
}

interface Analytics {
  totals: {
    employees: number; groups: number; broadcasts: number;
    sent: number; delivered: number; failed: number; read: number; responses: number;
  };
  deliveryRate: number;
  responseRate: number;
}

const DEFAULT_AUDIENCE: RecipientAudience = { mode: 'all', sendToAll: true };

export function EmployeeCommunicationPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('employees');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [profileOpen, setProfileOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [groupDialog, setGroupDialog] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', color: '#651147', department: '' });
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [assignGroupOpen, setAssignGroupOpen] = useState(false);
  const [assignGroupIds, setAssignGroupIds] = useState<string[]>([]);
  const [broadcastDialog, setBroadcastDialog] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ name: '', message: '', type: 'ANNOUNCEMENT', sendNow: true, isEmergency: false });
  const [audience, setAudience] = useState<RecipientAudience>(DEFAULT_AUDIENCE);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', content: '', category: 'GENERAL' });
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['employees'] });
    void queryClient.invalidateQueries({ queryKey: ['employee-groups'] });
    void queryClient.invalidateQueries({ queryKey: ['employee-broadcasts'] });
    void queryClient.invalidateQueries({ queryKey: ['employee-templates'] });
    void queryClient.invalidateQueries({ queryKey: ['employee-inbox'] });
    void queryClient.invalidateQueries({ queryKey: ['employee-comms-analytics'] });
  }, [queryClient]);

  const { data: analytics } = useQuery({
    queryKey: ['employee-comms-analytics'],
    queryFn: async () => extractData<Analytics>(await api.get('/employee-comms/broadcasts/analytics')),
  });

  const { data: employeesData, isLoading: employeesLoading } = useQuery({
    queryKey: ['employees', search],
    queryFn: async () => extractData<Employee[]>(
      await api.get('/employee-comms/employees', { params: { search, limit: 100 } })
    ),
  });

  const { data: groups } = useQuery({
    queryKey: ['employee-groups'],
    queryFn: async () => extractData<Group[]>(await api.get('/employee-comms/groups')),
  });

  const { data: groupDetail } = useQuery({
    queryKey: ['employee-group', selectedGroupId],
    queryFn: async () => extractData<Group>(await api.get(`/employee-comms/groups/${selectedGroupId}`)),
    enabled: Boolean(selectedGroupId),
  });

  const { data: broadcastsData, isLoading: broadcastsLoading } = useQuery({
    queryKey: ['employee-broadcasts'],
    queryFn: async () => extractData<Broadcast[]>(
      await api.get('/employee-comms/broadcasts', { params: { limit: 50 } })
    ),
  });

  const { data: templates } = useQuery({
    queryKey: ['employee-templates'],
    queryFn: async () => extractData<Template[]>(await api.get('/employee-comms/templates')),
  });

  const { data: inboxData } = useQuery({
    queryKey: ['employee-inbox'],
    queryFn: async () => extractData<InboxConversation[]>(
      await api.get('/employee-comms/inbox', { params: { limit: 50 } })
    ),
  });

  const { data: conversationDetail } = useQuery({
    queryKey: ['employee-inbox', selectedConversation],
    queryFn: async () => extractData<InboxConversation & { messages: Array<{ id: string; content: string; direction: string; createdAt: string }> }>(
      await api.get(`/employee-comms/inbox/${selectedConversation}`)
    ),
    enabled: Boolean(selectedConversation),
  });

  const employees = employeesData ?? [];
  const broadcasts = broadcastsData ?? [];
  const inbox = inboxData ?? [];
  const allSelected = employees.length > 0 && selectedIds.size === employees.length;

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(employees.map((e) => e.id)));
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const saveEmployee = useMutation({
    mutationFn: async (form: EmployeeFormData) => {
      const payload = { ...form, whatsappNumber: form.whatsappNumber || form.phone };
      if (editingEmployee) {
        return extractData(await api.patch(`/employee-comms/employees/${editingEmployee.id}`, payload));
      }
      return extractData(await api.post('/employee-comms/employees', payload));
    },
    onSuccess: () => {
      toast.success(editingEmployee ? 'Employee updated' : 'Employee added');
      setProfileOpen(false);
      setEditingEmployee(null);
      invalidate();
    },
    onError: () => toast.error('Failed to save employee'),
  });

  const bulkAssignGroups = useMutation({
    mutationFn: async () => extractData(
      await api.post('/employee-comms/employees/bulk-assign-groups', {
        employeeIds: Array.from(selectedIds),
        groupIds: assignGroupIds,
      })
    ),
    onSuccess: () => {
      toast.success('Employees assigned to groups');
      setAssignGroupOpen(false);
      setAssignGroupIds([]);
      setSelectedIds(new Set());
      invalidate();
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async () => extractData(
      await api.post('/employee-comms/employees/bulk-delete', { employeeIds: Array.from(selectedIds) })
    ),
    onSuccess: () => {
      toast.success('Employees removed');
      setSelectedIds(new Set());
      invalidate();
    },
  });

  const exportEmployees = async (format: 'csv' | 'xlsx' | 'json') => {
    const res = await api.post('/employee-comms/employees/export', {
      format,
      employeeIds: selectedIds.size ? Array.from(selectedIds) : undefined,
    }, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees.${format === 'json' ? 'json' : format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveGroup = useMutation({
    mutationFn: async () => extractData(await api.post('/employee-comms/groups', groupForm)),
    onSuccess: () => {
      toast.success('Group created');
      setGroupDialog(false);
      setGroupForm({ name: '', description: '', color: '#651147', department: '' });
      invalidate();
    },
  });

  const addMembersToGroup = useMutation({
    mutationFn: async ({ groupId, employeeIds }: { groupId: string; employeeIds: string[] }) =>
      extractData(await api.post(`/employee-comms/groups/${groupId}/members`, { employeeIds })),
    onSuccess: () => { toast.success('Members added'); invalidate(); },
  });

  const removeMemberFromGroup = useMutation({
    mutationFn: async ({ groupId, employeeIds }: { groupId: string; employeeIds: string[] }) =>
      extractData(await api.post(`/employee-comms/groups/${groupId}/members/remove`, { employeeIds })),
    onSuccess: () => { toast.success('Member removed'); invalidate(); },
  });

  const duplicateGroup = useMutation({
    mutationFn: async (id: string) => extractData(await api.post(`/employee-comms/groups/${id}/duplicate`)),
    onSuccess: () => { toast.success('Group duplicated'); invalidate(); },
  });

  const archiveGroup = useMutation({
    mutationFn: async (id: string) => extractData(await api.post(`/employee-comms/groups/${id}/archive`)),
    onSuccess: () => { toast.success('Group archived'); setSelectedGroupId(null); invalidate(); },
  });

  const saveBroadcast = useMutation({
    mutationFn: async () => extractData(await api.post('/employee-comms/broadcasts', {
      ...broadcastForm,
      ...buildPayload(audience),
      sendNow: broadcastForm.sendNow,
    })),
    onSuccess: () => {
      toast.success('Broadcast queued');
      setBroadcastDialog(false);
      setBroadcastForm({ name: '', message: '', type: 'ANNOUNCEMENT', sendNow: true, isEmergency: false });
      setAudience(DEFAULT_AUDIENCE);
      invalidate();
    },
    onError: () => toast.error('Failed to create broadcast'),
  });

  const saveTemplate = useMutation({
    mutationFn: async () => extractData(await api.post('/employee-comms/templates', templateForm)),
    onSuccess: () => {
      toast.success('Template saved');
      setTemplateDialog(false);
      invalidate();
    },
  });

  const sendReply = useMutation({
    mutationFn: async () => extractData(
      await api.post(`/employee-comms/inbox/${selectedConversation}/reply`, { content: replyText })
    ),
    onSuccess: () => {
      toast.success('Reply sent');
      setReplyText('');
      invalidate();
    },
  });

  const openEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setProfileOpen(true);
  };

  const openNew = () => {
    setEditingEmployee(null);
    setProfileOpen(true);
  };

  const statusColor = useMemo(() => ({
    ACTIVE: 'bg-success/10 text-success',
    SCHEDULED: 'bg-warning/10 text-warning',
    RUNNING: 'bg-primary/10 text-primary',
    COMPLETED: 'bg-success/10 text-success',
    FAILED: 'bg-destructive/10 text-destructive',
    DRAFT: 'bg-muted text-muted-foreground',
  }), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employee Communication Center</h1>
          <p className="text-muted-foreground">
            Manage employees, groups, broadcasts, and internal WhatsApp conversations
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />Import
          </Button>
          <Button variant="outline" onClick={() => { setBroadcastDialog(true); setTab('broadcasts'); }}>
            <Send className="mr-2 h-4 w-4" />New Broadcast
          </Button>
          <Button className="bg-accent hover:bg-accent/90" onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />Add Employee
          </Button>
        </div>
      </div>

      {analytics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Employees</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{analytics.totals.employees}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Groups</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{analytics.totals.groups}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Messages Sent</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{analytics.totals.sent}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Delivery Rate</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{analytics.deliveryRate}%</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Response Rate</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{analytics.responseRate}%</p></CardContent></Card>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="employees"><Users className="mr-1 h-4 w-4" />Employees</TabsTrigger>
          <TabsTrigger value="groups"><UsersRound className="mr-1 h-4 w-4" />Groups</TabsTrigger>
          <TabsTrigger value="broadcasts"><Radio className="mr-1 h-4 w-4" />Broadcasts</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="mr-1 h-4 w-4" />Templates</TabsTrigger>
          <TabsTrigger value="inbox"><MessageSquare className="mr-1 h-4 w-4" />Inbox</TabsTrigger>
        </TabsList>

        {/* EMPLOYEES TAB */}
        <TabsContent value="employees" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Search name, phone, email, department..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
            {selectedIds.size > 0 && (
              <>
                <Badge variant="outline">{selectedIds.size} selected</Badge>
                <Button size="sm" variant="outline" onClick={() => setAssignGroupOpen(true)}>
                  <UserPlus className="mr-1 h-3 w-3" />Add to Group
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportEmployees('csv')}>
                  <Download className="mr-1 h-3 w-3" />Export
                </Button>
                <Button size="sm" variant="destructive" onClick={() => bulkDelete.mutate()}>
                  <Trash2 className="mr-1 h-3 w-3" />Delete
                </Button>
              </>
            )}
          </div>
          {employeesLoading ? <LoadingState rows={5} /> : !employees.length ? (
            <EmptyState title="No employees" description="Add employees or import from CSV/Excel." />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Groups</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <input type="checkbox" checked={selectedIds.has(emp.id)}
                          onChange={() => toggleSelect(emp.id)} className="rounded" />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{emp.fullName}</p>
                          {emp.jobTitle && <p className="text-xs text-muted-foreground">{emp.jobTitle}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {emp.groupMembers?.length
                            ? emp.groupMembers.map((m) => (
                              <Badge key={m.group.id} variant="outline" className="text-[10px]">{m.group.name}</Badge>
                            ))
                            : <span className="text-xs text-muted-foreground">No groups</span>}
                        </div>
                      </TableCell>
                      <TableCell>{emp.department ?? '—'}</TableCell>
                      <TableCell>{emp.phone}</TableCell>
                      <TableCell>
                        <Badge className={cn('text-[10px]', statusColor[emp.status as keyof typeof statusColor] ?? '')}>
                          {emp.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* GROUPS TAB */}
        <TabsContent value="groups" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-1">
              <div className="flex justify-between">
                <h3 className="font-semibold">Groups</h3>
                <Button size="sm" onClick={() => setGroupDialog(true)}><Plus className="mr-1 h-3 w-3" />Create</Button>
              </div>
              <div className="space-y-2">
                {(groups ?? []).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGroupId(g.id)}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50',
                      selectedGroupId === g.id && 'border-accent bg-accent/5'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: g.color }} />
                      <span className="font-medium">{g.name}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">{g._count?.members ?? 0}</Badge>
                    </div>
                    {g.department && <p className="mt-1 text-xs text-muted-foreground">{g.department}</p>}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-lg border p-4 lg:col-span-2">
              {selectedGroupId && groupDetail ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{groupDetail.name}</h3>
                      <p className="text-sm text-muted-foreground">{groupDetail.description}</p>
                      <p className="mt-1 text-sm">{groupDetail._count?.members ?? 0} members</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => duplicateGroup.mutate(selectedGroupId)}>
                          <Copy className="mr-2 h-4 w-4" />Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => archiveGroup.mutate(selectedGroupId)}>
                          <Archive className="mr-2 h-4 w-4" />Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <Label>Members</Label>
                      {selectedIds.size > 0 && (
                        <Button size="sm" variant="outline" onClick={() =>
                          addMembersToGroup.mutate({ groupId: selectedGroupId, employeeIds: Array.from(selectedIds) })
                        }>
                          <UserPlus className="mr-1 h-3 w-3" />Add {selectedIds.size} selected
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {groupDetail.members?.map((m) => (
                        <div key={m.employee.id} className="flex items-center justify-between rounded border p-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">{getInitials(m.employee.fullName)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{m.employee.fullName}</p>
                              <p className="text-xs text-muted-foreground">{m.employee.department}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() =>
                            removeMemberFromGroup.mutate({ groupId: selectedGroupId, employeeIds: [m.employee.id] })
                          }>Remove</Button>
                        </div>
                      ))}
                      {!groupDetail.members?.length && (
                        <p className="text-sm text-muted-foreground">No members yet. Select employees and add them.</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tip: Go to Employees tab, select employees with checkboxes, then add them here.
                  </p>
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center text-muted-foreground">
                  Select a group to manage members
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* BROADCASTS TAB */}
        <TabsContent value="broadcasts" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button className="bg-accent hover:bg-accent/90" onClick={() => setBroadcastDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />Create Broadcast
            </Button>
          </div>
          {broadcastsLoading ? <LoadingState rows={4} /> : !broadcasts.length ? (
            <EmptyState title="No broadcasts" description="Send announcements to employees via WhatsApp." />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Delivered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {broadcasts.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        {b.name}
                        {b.isEmergency && <Badge className="ml-2 bg-destructive text-[10px]">Emergency</Badge>}
                      </TableCell>
                      <TableCell>{b.type}</TableCell>
                      <TableCell>
                        <Badge className={cn('text-[10px]', statusColor[b.status as keyof typeof statusColor] ?? '')}>
                          {b.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{b._count?.recipients ?? 0}</TableCell>
                      <TableCell>{b.sentCount}</TableCell>
                      <TableCell>{b.deliveredCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* TEMPLATES TAB */}
        <TabsContent value="templates" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setTemplateDialog(true)}><Plus className="mr-2 h-4 w-4" />New Template</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(templates ?? []).map((t) => (
              <Card key={t.id}>
                <CardContent className="p-4">
                  <h3 className="font-semibold">{t.name}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{t.content}</p>
                  <Button variant="link" className="mt-2 h-auto p-0" onClick={() => {
                    setBroadcastForm((f) => ({ ...f, message: t.content, name: t.name }));
                    setBroadcastDialog(true);
                  }}>Use in broadcast</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* INBOX TAB */}
        <TabsContent value="inbox" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border lg:col-span-1 divide-y max-h-[500px] overflow-y-auto">
              {!inbox.length ? (
                <EmptyState title="No conversations" description="Employee replies appear here." />
              ) : inbox.map((c) => (
                <button key={c.id} type="button"
                  className={cn('w-full p-4 text-left hover:bg-muted/50', selectedConversation === c.id && 'bg-muted')}
                  onClick={() => setSelectedConversation(c.id)}>
                  <div className="flex justify-between">
                    <p className="font-medium">{c.employee.fullName}</p>
                    {c.unreadCount > 0 && <Badge className="bg-accent text-[10px]">{c.unreadCount}</Badge>}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{c.messages?.[0]?.content}</p>
                </button>
              ))}
            </div>
            <div className="rounded-lg border lg:col-span-2">
              {selectedConversation && conversationDetail ? (
                <div className="flex h-[500px] flex-col">
                  <div className="border-b p-4">
                    <h3 className="font-semibold">{conversationDetail.employee.fullName}</h3>
                    <p className="text-sm text-muted-foreground">{conversationDetail.employee.phone}</p>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {conversationDetail.messages?.map((m, i) => (
                      <div key={m.id ?? `${m.createdAt}-${i}`} className={cn('max-w-[80%] rounded-lg px-3 py-2 text-sm',
                        m.direction === 'OUTBOUND' ? 'ml-auto bg-accent text-white' : 'bg-muted')}>
                        {m.content}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 border-t p-4">
                    <Input placeholder="Type a reply..." value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && replyText.trim() && sendReply.mutate()} />
                    <Button className="bg-accent hover:bg-accent/90" disabled={!replyText.trim()}
                      onClick={() => sendReply.mutate()}><Send className="h-4 w-4" /></Button>
                  </div>
                </div>
              ) : (
                <div className="flex h-[500px] items-center justify-center text-muted-foreground">
                  Select a conversation
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <EmployeeProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        employeeId={editingEmployee?.id ?? null}
        initialData={editingEmployee ? {
          fullName: editingEmployee.fullName,
          phone: editingEmployee.phone,
          whatsappNumber: editingEmployee.whatsappNumber,
          email: editingEmployee.email,
          employeeCode: editingEmployee.employeeCode,
          jobTitle: editingEmployee.jobTitle,
          department: editingEmployee.department,
          branch: editingEmployee.branch,
          role: editingEmployee.role,
          status: editingEmployee.status,
          employmentType: editingEmployee.employmentType,
          notes: editingEmployee.notes,
          emergencyContact: editingEmployee.emergencyContact,
          tags: editingEmployee.tags,
          groupIds: editingEmployee.groupMembers?.map((m) => m.group.id),
        } : undefined}
        onSave={(form) => saveEmployee.mutate(form)}
        saving={saveEmployee.isPending}
      />

      <EmployeeImportDialog open={importOpen} onOpenChange={setImportOpen} onSuccess={invalidate} />

      {/* Assign to Group Dialog */}
      <Dialog open={assignGroupOpen} onOpenChange={setAssignGroupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign to Groups</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-muted-foreground">Assign {selectedIds.size} employee(s) to:</p>
            {(groups ?? []).map((g) => (
              <label key={g.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="rounded"
                  checked={assignGroupIds.includes(g.id)}
                  onChange={(e) => {
                    setAssignGroupIds(e.target.checked
                      ? [...assignGroupIds, g.id]
                      : assignGroupIds.filter((id) => id !== g.id));
                  }} />
                {g.name}
              </label>
            ))}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignGroupOpen(false)}>Cancel</Button>
            <Button onClick={() => bulkAssignGroups.mutate()} disabled={!assignGroupIds.length}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Create Dialog */}
      <Dialog open={groupDialog} onOpenChange={setGroupDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Group</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2"><Label>Name</Label>
              <Input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Description</Label>
              <Input value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Department</Label>
              <Input value={groupForm.department} onChange={(e) => setGroupForm({ ...groupForm, department: e.target.value })} /></div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialog(false)}>Cancel</Button>
            <Button onClick={() => saveGroup.mutate()} disabled={saveGroup.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Broadcast Dialog */}
      <Dialog open={broadcastDialog} onOpenChange={setBroadcastDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Employee Broadcast</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Name</Label>
                <Input value={broadcastForm.name} onChange={(e) => setBroadcastForm({ ...broadcastForm, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Type</Label>
                <Select value={broadcastForm.type} onValueChange={(v) => setBroadcastForm({ ...broadcastForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BROADCAST_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select></div>
            </div>
            <RecipientBuilder audience={audience} onChange={setAudience} />
            <div className="space-y-2"><Label>Message</Label>
              <Textarea rows={4} value={broadcastForm.message}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                placeholder="Use {{employee_name}} for personalization" /></div>
            <div className="flex gap-2">
              <Input placeholder="AI prompt..." value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
              <Button variant="outline" onClick={async () => {
                try {
                  const r = await extractData<{ message: string }>(
                    await api.post('/employee-comms/broadcasts/generate-ai', { prompt: aiPrompt, type: broadcastForm.type })
                  );
                  setBroadcastForm((f) => ({ ...f, message: r.message }));
                  toast.success('AI message generated');
                } catch { toast.error('AI failed'); }
              }}><Sparkles className="h-4 w-4" /></Button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={broadcastForm.sendNow}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, sendNow: e.target.checked })} />
              Send immediately
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={broadcastForm.isEmergency}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, isEmergency: e.target.checked })} />
              Emergency alert
            </label>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBroadcastDialog(false)}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90" onClick={() => saveBroadcast.mutate()}
              disabled={saveBroadcast.isPending || !broadcastForm.name || !broadcastForm.message}>
              <Send className="mr-2 h-4 w-4" />{broadcastForm.sendNow ? 'Send Now' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Template</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2"><Label>Name</Label>
              <Input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Content</Label>
              <Textarea rows={5} value={templateForm.content}
                onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })} /></div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog(false)}>Cancel</Button>
            <Button onClick={() => saveTemplate.mutate()} disabled={saveTemplate.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
