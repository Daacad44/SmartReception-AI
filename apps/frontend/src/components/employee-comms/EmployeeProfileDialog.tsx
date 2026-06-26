import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { extractData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY'];
const STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED'];

export interface EmployeeFormData {
  fullName: string;
  phone: string;
  whatsappNumber?: string;
  email?: string;
  employeeCode?: string;
  jobTitle?: string;
  department?: string;
  branch?: string;
  role?: string;
  status: string;
  employmentType: string;
  language?: string;
  timezone?: string;
  notes?: string;
  emergencyContact?: string;
  tags?: string[];
  groupIds?: string[];
}

interface Group {
  id: string;
  name: string;
  color: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string | null;
  initialData?: Partial<EmployeeFormData>;
  onSave: (data: EmployeeFormData) => void;
  saving?: boolean;
}

export function EmployeeProfileDialog({
  open, onOpenChange, employeeId, initialData, onSave, saving,
}: Props) {
  const [form, setForm] = useState<EmployeeFormData>({
    fullName: '', phone: '', status: 'ACTIVE', employmentType: 'FULL_TIME', groupIds: [],
  });

  const { data: groups } = useQuery({
    queryKey: ['employee-groups'],
    queryFn: async () => extractData<Group[]>(await api.get('/employee-comms/groups')),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setForm({
        fullName: initialData?.fullName ?? '',
        phone: initialData?.phone ?? '',
        whatsappNumber: initialData?.whatsappNumber ?? '',
        email: initialData?.email ?? '',
        employeeCode: initialData?.employeeCode ?? '',
        jobTitle: initialData?.jobTitle ?? '',
        department: initialData?.department ?? '',
        branch: initialData?.branch ?? '',
        role: initialData?.role ?? '',
        status: initialData?.status ?? 'ACTIVE',
        employmentType: initialData?.employmentType ?? 'FULL_TIME',
        language: initialData?.language ?? 'so',
        timezone: initialData?.timezone ?? '',
        notes: initialData?.notes ?? '',
        emergencyContact: initialData?.emergencyContact ?? '',
        tags: initialData?.tags ?? [],
        groupIds: initialData?.groupIds ?? [],
      });
    }
  }, [open, initialData]);

  const toggleGroup = (groupId: string) => {
    const current = form.groupIds ?? [];
    const next = current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId];
    setForm({ ...form, groupIds: next });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employeeId ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Employee ID</Label>
              <Input value={form.employeeCode ?? ''} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={form.whatsappNumber ?? ''} onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Job Title</Label>
              <Input value={form.jobTitle ?? ''} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={form.department ?? ''} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Input value={form.branch ?? ''} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={form.role ?? ''} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Employment Type</Label>
              <Select value={form.employmentType} onValueChange={(v) => setForm({ ...form, employmentType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Emergency Contact</Label>
              <Input value={form.emergencyContact ?? ''} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tags (comma-separated)</Label>
              <Input
                value={(form.tags ?? []).join(', ')}
                onChange={(e) => setForm({
                  ...form,
                  tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Groups</Label>
            <div className="flex flex-wrap gap-2">
              {(groups ?? []).map((g) => {
                const selected = form.groupIds?.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGroup(g.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      selected ? 'border-accent bg-accent/10 text-accent' : 'border-border hover:bg-muted'
                    }`}
                  >
                    <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                    {g.name}
                  </button>
                );
              })}
              {!groups?.length && <p className="text-sm text-muted-foreground">No groups yet. Create a group first.</p>}
            </div>
            {(form.groupIds?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {form.groupIds!.map((id) => {
                  const g = groups?.find((x) => x.id === id);
                  return g ? <Badge key={id} variant="outline">{g.name}</Badge> : null;
                })}
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-accent hover:bg-accent/90" onClick={() => onSave(form)} disabled={saving || !form.fullName || !form.phone}>
            Save Employee
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
