import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Send, Plus, FileText, Trash2, Pencil, MessageSquare,
  Sparkles, Loader2, UsersRound, Radio,
} from 'lucide-react';
import api, { extractData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BROADCAST_TYPES = [
  'ANNOUNCEMENT', 'NOTIFICATION', 'EMERGENCY', 'MEETING', 'HOLIDAY', 'POLICY',
  'TRAINING', 'MOTIVATION', 'PAYROLL', 'SHIFT', 'CUSTOM',
];
const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY'];
const STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED'];

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
  groupMembers?: Array<{ group: { id: string; name: string } }>;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  color: string;
  isSystem: boolean;
  _count?: { members: number };
}

interface Broadcast {
  id: string;
  name: string;
  message: string;
  type: string;
  schedule: string;
  status: string;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  readCount: number;
  isEmergency?: boolean;
  group?: { name: string };
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
  lastMessageAt?: string;
  employee: { id: string; fullName: string; phone: string; department?: string };
  messages?: Array<{ content: string; direction: string; createdAt: string }>;
}

interface Analytics {
  totals: { broadcasts: number; sent: number; delivered: number; failed: number; read: number; responses: number };
  deliveryRate: number;
}

const INITIAL_EMPLOYEE = {
  fullName: '', phone: '', jobTitle: '', department: '', branch: '',
  email: '', employmentType: 'FULL_TIME', status: 'ACTIVE',
};

const INITIAL_BROADCAST = {
  name: '', message: '', type: 'ANNOUNCEMENT', schedule: 'ONE_TIME',
  sendToAll: false, sendNow: true, groupId: '', department: '', branch: '',
  employeeIds: [] as string[], isEmergency: false,
};

export function EmployeeCommunicationPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('employees');
  const [search, setSearch] = useState('');
  const [employeeDialog, setEmployeeDialog] = useState(false);
  const [employeeForm, setEmployeeForm] = useState(INITIAL_EMPLOYEE);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [groupDialog, setGroupDialog] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', color: '#651147' });
  const [broadcastDialog, setBroadcastDialog] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState(INITIAL_BROADCAST);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', content: '', category: 'GENERAL' });
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const { data: analytics } = useQuery({
    queryKey: ['employee-comms-analytics'],
    queryFn: async () => extractData<Analytics>(await api.get('/employee-comms/broadcasts/analytics')),
  });

  const { data: employeesData, isLoading: employeesLoading } = useQuery({
    queryKey: ['employees', search],
    queryFn: async () => extractData<Employee[]>(
      await api.get('/employee-comms/employees', { params: { search, limit: 50 } })
    ),
  });

  const { data: groups } = useQuery({
    queryKey: ['employee-groups'],
    queryFn: async () => extractData<Group[]>(await api.get('/employee-comms/groups')),
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
    queryFn: async () => extractData<InboxConversation>(
      await api.get(`/employee-comms/inbox/${selectedConversation}`)
    ),
    enabled: Boolean(selectedConversation),
  });

  const employees = employeesData ?? [];
  const broadcasts = broadcastsData ?? [];
  const inbox = inboxData ?? [];

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['employees'] });
    void queryClient.invalidateQueries({ queryKey: ['employee-groups'] });
    void queryClient.invalidateQueries({ queryKey: ['employee-broadcasts'] });
    void queryClient.invalidateQueries({ queryKey: ['employee-templates'] });
    void queryClient.invalidateQueries({ queryKey: ['employee-inbox'] });
    void queryClient.invalidateQueries({ queryKey: ['employee-comms-analytics'] });
  }, [queryClient]);

  const saveEmployee = useMutation({
    mutationFn: async () => {
      if (editingEmployeeId) {
        return extractData(await api.patch(`/employee-comms/employees/${editingEmployeeId}`, employeeForm));
      }
      return extractData(await api.post('/employee-comms/employees', employeeForm));
    },
    onSuccess: () => {
      toast.success(editingEmployeeId ? 'Employee updated' : 'Employee added');
      setEmployeeDialog(false);
      setEditingEmployeeId(null);
      setEmployeeForm(INITIAL_EMPLOYEE);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to save employee'),
  });

  const deleteEmployee = useMutation({
    mutationFn: async (id: string) => extractData(await api.delete(`/employee-comms/employees/${id}`)),
    onSuccess: () => { toast.success('Employee removed'); invalidate(); },
  });

  const saveGroup = useMutation({
    mutationFn: async () => extractData(await api.post('/employee-comms/groups', groupForm)),
    onSuccess: () => {
      toast.success('Group created');
      setGroupDialog(false);
      setGroupForm({ name: '', description: '', color: '#651147' });
      invalidate();
    },
  });

  const saveBroadcast = useMutation({
    mutationFn: async () => extractData(await api.post('/employee-comms/broadcasts', {
      ...broadcastForm,
      groupId: broadcastForm.groupId || undefined,
      department: broadcastForm.department || undefined,
      branch: broadcastForm.branch || undefined,
    })),
    onSuccess: () => {
      toast.success('Broadcast queued');
      setBroadcastDialog(false);
      setBroadcastForm(INITIAL_BROADCAST);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create broadcast'),
  });

  const sendBroadcast = useMutation({
    mutationFn: async (id: string) => extractData(await api.post(`/employee-comms/broadcasts/${id}/send`)),
    onSuccess: () => { toast.success('Broadcast sent'); invalidate(); },
  });

  const saveTemplate = useMutation({
    mutationFn: async () => extractData(await api.post('/employee-comms/templates', templateForm)),
    onSuccess: () => {
      toast.success('Template saved');
      setTemplateDialog(false);
      setTemplateForm({ name: '', content: '', category: 'GENERAL' });
      invalidate();
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => extractData(await api.delete(`/employee-comms/templates/${id}`)),
    onSuccess: () => { toast.success('Template deleted'); invalidate(); },
  });

  const sendReply = useMutation({
    mutationFn: async () => extractData(
      await api.post(`/employee-comms/inbox/${selectedConversation}/reply`, { content: replyText })
    ),
    onSuccess: () => {
      toast.success('Reply sent');
      setReplyText('');
      void queryClient.invalidateQueries({ queryKey: ['employee-inbox', selectedConversation] });
      invalidate();
    },
  });

  const generateAi = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const result = await extractData<{ message: string }>(
        await api.post('/employee-comms/broadcasts/generate-ai', {
          prompt: aiPrompt,
          type: broadcastForm.type,
          tone: 'professional',
        })
      );
      setBroadcastForm((f) => ({ ...f, message: result.message }));
      toast.success('AI message generated');
    } catch {
      toast.error('AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const statusColor = useMemo(() => ({
    ACTIVE: 'bg-success/10 text-success',
    SCHEDULED: 'bg-warning/10 text-warning',
    RUNNING: 'bg-primary/10 text-primary',
    COMPLETED: 'bg-success/10 text-success',
    FAILED: 'bg-destructive/10 text-destructive',
    DRAFT: 'bg-muted text-muted-foreground',
  }), []);

  const openEditEmployee = (emp: Employee) => {
    setEditingEmployeeId(emp.id);
    setEmployeeForm({
      fullName: emp.fullName,
      phone: emp.phone,
      jobTitle: emp.jobTitle ?? '',
      department: emp.department ?? '',
      branch: emp.branch ?? '',
      email: emp.email ?? '',
      employmentType: emp.employmentType,
      status: emp.status,
    });
    setEmployeeDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employee Communication Center</h1>
          <p className="text-muted-foreground">
            Manage employees, send broadcasts, and handle internal WhatsApp conversations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setBroadcastDialog(true); setTab('broadcasts'); }}>
            <Send className="mr-2 h-4 w-4" />
            New Broadcast
          </Button>
          <Button className="bg-accent hover:bg-accent/90" onClick={() => setEmployeeDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        </div>
      </div>

      {analytics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Broadcasts</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{analytics.totals.broadcasts}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Messages Sent</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{analytics.totals.sent}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Delivery Rate</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{analytics.deliveryRate}%</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Responses</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{analytics.totals.responses}</p></CardContent>
          </Card>
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

        <TabsContent value="employees" className="mt-4 space-y-4">
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          {employeesLoading ? (
            <LoadingState rows={5} />
          ) : !employees.length ? (
            <EmptyState title="No employees" description="Add your first employee to start internal messaging." />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.fullName}</TableCell>
                      <TableCell>{emp.jobTitle ?? '—'}</TableCell>
                      <TableCell>{emp.department ?? '—'}</TableCell>
                      <TableCell>{emp.phone}</TableCell>
                      <TableCell>
                        <Badge className={cn('text-[10px]', statusColor[emp.status as keyof typeof statusColor] ?? '')}>
                          {emp.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditEmployee(emp)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteEmployee.mutate(emp.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="groups" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setGroupDialog(true)}><Plus className="mr-2 h-4 w-4" />Create Group</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(groups ?? []).map((g) => (
              <Card key={g.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: g.color }} />
                    <h3 className="font-semibold">{g.name}</h3>
                    {g.isSystem && <Badge variant="outline" className="text-[10px]">System</Badge>}
                  </div>
                  {g.description && <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>}
                  <p className="mt-2 text-sm">{g._count?.members ?? 0} members</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="broadcasts" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button className="bg-accent hover:bg-accent/90" onClick={() => setBroadcastDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />Create Broadcast
            </Button>
          </div>
          {broadcastsLoading ? (
            <LoadingState rows={4} />
          ) : !broadcasts.length ? (
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
                    <TableHead className="w-24" />
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
                      <TableCell>
                        {b.status === 'DRAFT' && (
                          <Button size="sm" variant="outline" onClick={() => sendBroadcast.mutate(b.id)}>
                            <Send className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setTemplateDialog(true)}><Plus className="mr-2 h-4 w-4" />New Template</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(templates ?? []).map((t) => (
              <Card key={t.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{t.name}</h3>
                      <Badge variant="outline" className="mt-1 text-[10px]">{t.category}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteTemplate.mutate(t.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{t.content}</p>
                  <Button
                    variant="link"
                    className="mt-2 h-auto p-0"
                    onClick={() => {
                      setBroadcastForm((f) => ({ ...f, message: t.content, name: t.name }));
                      setBroadcastDialog(true);
                      setTab('broadcasts');
                    }}
                  >
                    Use in broadcast
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="inbox" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border lg:col-span-1">
              {!inbox.length ? (
                <EmptyState title="No conversations" description="Employee replies will appear here." />
              ) : (
                <div className="divide-y">
                  {inbox.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={cn(
                        'w-full p-4 text-left hover:bg-muted/50',
                        selectedConversation === c.id && 'bg-muted'
                      )}
                      onClick={() => setSelectedConversation(c.id)}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{c.employee.fullName}</p>
                        {c.unreadCount > 0 && (
                          <Badge className="bg-accent text-[10px]">{c.unreadCount}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{c.employee.department}</p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {c.messages?.[0]?.content}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border lg:col-span-2">
              {selectedConversation && conversationDetail ? (
                <div className="flex h-[500px] flex-col">
                  <div className="border-b p-4">
                    <h3 className="font-semibold">{conversationDetail.employee.fullName}</h3>
                    <p className="text-sm text-muted-foreground">{conversationDetail.employee.phone}</p>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {(conversationDetail as { messages?: Array<{ id: string; content: string; direction: string; createdAt: string }> }).messages?.map((m) => (
                      <div
                        key={m.id ?? m.createdAt}
                        className={cn(
                          'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                          m.direction === 'OUTBOUND'
                            ? 'ml-auto bg-accent text-white'
                            : 'bg-muted'
                        )}
                      >
                        {m.content}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 border-t p-4">
                    <Input
                      placeholder="Type a reply..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && replyText.trim() && sendReply.mutate()}
                    />
                    <Button
                      className="bg-accent hover:bg-accent/90"
                      disabled={!replyText.trim() || sendReply.isPending}
                      onClick={() => sendReply.mutate()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
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

      {/* Employee Dialog */}
      <Dialog open={employeeDialog} onOpenChange={setEmployeeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEmployeeId ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={employeeForm.fullName} onChange={(e) => setEmployeeForm({ ...employeeForm, fullName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={employeeForm.phone} onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Job Title</Label>
                <Input value={employeeForm.jobTitle} onChange={(e) => setEmployeeForm({ ...employeeForm, jobTitle: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input value={employeeForm.department} onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <Input value={employeeForm.branch} onChange={(e) => setEmployeeForm({ ...employeeForm, branch: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Employment Type</Label>
                <Select value={employeeForm.employmentType} onValueChange={(v) => setEmployeeForm({ ...employeeForm, employmentType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={employeeForm.status} onValueChange={(v) => setEmployeeForm({ ...employeeForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmployeeDialog(false)}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90" onClick={() => saveEmployee.mutate()} disabled={saveEmployee.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Dialog */}
      <Dialog open={groupDialog} onOpenChange={setGroupDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Group</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialog(false)}>Cancel</Button>
            <Button onClick={() => saveGroup.mutate()} disabled={saveGroup.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Broadcast Dialog */}
      <Dialog open={broadcastDialog} onOpenChange={setBroadcastDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Create Employee Broadcast</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={broadcastForm.name} onChange={(e) => setBroadcastForm({ ...broadcastForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={broadcastForm.type} onValueChange={(v) => setBroadcastForm({ ...broadcastForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BROADCAST_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Audience</Label>
              <Select
                value={broadcastForm.sendToAll ? 'all' : broadcastForm.groupId ? 'group' : 'department'}
                onValueChange={(v) => setBroadcastForm({
                  ...broadcastForm,
                  sendToAll: v === 'all',
                  groupId: v === 'group' ? (groups?.[0]?.id ?? '') : '',
                })}
              >
                <SelectTrigger><SelectValue placeholder="Select audience" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Entire Company</SelectItem>
                  <SelectItem value="group">Custom Group</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {broadcastForm.groupId && !broadcastForm.sendToAll && (
              <div className="space-y-2">
                <Label>Group</Label>
                <Select value={broadcastForm.groupId} onValueChange={(v) => setBroadcastForm({ ...broadcastForm, groupId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(groups ?? []).map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                rows={5}
                value={broadcastForm.message}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                placeholder="Use {{employee_name}} for personalization"
              />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="AI prompt: e.g. weekly goals reminder"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
              />
              <Button variant="outline" onClick={generateAi} disabled={aiLoading}>
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={broadcastForm.sendNow}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, sendNow: e.target.checked })}
                />
                Send immediately
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={broadcastForm.isEmergency}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, isEmergency: e.target.checked })}
                />
                Emergency alert
              </label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBroadcastDialog(false)}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90" onClick={() => saveBroadcast.mutate()} disabled={saveBroadcast.isPending}>
              <Send className="mr-2 h-4 w-4" />
              {broadcastForm.sendNow ? 'Send Now' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Template</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea rows={5} value={templateForm.content} onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })} />
            </div>
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
