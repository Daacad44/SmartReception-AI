import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { extractData } from '@/lib/api';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export type AudienceMode =
  | 'all'
  | 'groups'
  | 'department'
  | 'branch'
  | 'role'
  | 'selected'
  | 'filter';

export interface RecipientAudience {
  mode: AudienceMode;
  sendToAll?: boolean;
  groupIds?: string[];
  department?: string;
  branch?: string;
  roles?: string[];
  tags?: string[];
  employeeIds?: string[];
  audienceFilter?: {
    department?: string;
    branch?: string;
    status?: string;
    roles?: string[];
    tags?: string[];
    logic?: 'AND' | 'OR';
  };
}

interface Group {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  fullName: string;
  department?: string;
}

interface Props {
  audience: RecipientAudience;
  onChange: (audience: RecipientAudience) => void;
}

export function RecipientBuilder({ audience, onChange }: Props) {
  const [previewCount, setPreviewCount] = useState(0);

  const { data: groups } = useQuery({
    queryKey: ['employee-groups'],
    queryFn: async () => extractData<Group[]>(await api.get('/employee-comms/groups')),
  });

  const { data: employees } = useQuery({
    queryKey: ['employees-all'],
    queryFn: async () => extractData<Employee[]>(
      await api.get('/employee-comms/employees', { params: { limit: 100 } })
    ),
  });

  useEffect(() => {
    const payload = buildPayload(audience);
    const timer = setTimeout(async () => {
      try {
        const result = await extractData<{ count: number }>(
          await api.post('/employee-comms/broadcasts/preview-recipients', payload)
        );
        setPreviewCount(result.count);
      } catch {
        setPreviewCount(0);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [audience]);

  const setMode = (mode: AudienceMode) => {
    onChange({ mode, sendToAll: mode === 'all' });
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Audience</Label>
        <Badge className="bg-accent">{previewCount} recipients</Badge>
      </div>

      <Select value={audience.mode} onValueChange={(v) => setMode(v as AudienceMode)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Entire Company</SelectItem>
          <SelectItem value="groups">One or More Groups</SelectItem>
          <SelectItem value="department">Department</SelectItem>
          <SelectItem value="branch">Branch</SelectItem>
          <SelectItem value="role">Role</SelectItem>
          <SelectItem value="selected">Selected Employees</SelectItem>
          <SelectItem value="filter">Smart Filter (AND)</SelectItem>
        </SelectContent>
      </Select>

      {audience.mode === 'groups' && (
        <div className="space-y-2">
          <Label>Groups</Label>
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {(groups ?? []).map((g) => (
              <label key={g.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={audience.groupIds?.includes(g.id) ?? false}
                  onChange={(e) => {
                    const current = audience.groupIds ?? [];
                    const next = e.target.checked
                      ? [...current, g.id]
                      : current.filter((id) => id !== g.id);
                    onChange({ ...audience, groupIds: next });
                  }}
                />
                {g.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {audience.mode === 'department' && (
        <div className="space-y-2">
          <Label>Department</Label>
          <Input
            value={audience.department ?? ''}
            onChange={(e) => onChange({ ...audience, department: e.target.value })}
            placeholder="e.g. Sales"
          />
        </div>
      )}

      {audience.mode === 'branch' && (
        <div className="space-y-2">
          <Label>Branch</Label>
          <Input
            value={audience.branch ?? ''}
            onChange={(e) => onChange({ ...audience, branch: e.target.value })}
            placeholder="e.g. Mogadishu"
          />
        </div>
      )}

      {audience.mode === 'role' && (
        <div className="space-y-2">
          <Label>Role</Label>
          <Input
            value={audience.roles?.[0] ?? ''}
            onChange={(e) => onChange({ ...audience, roles: e.target.value ? [e.target.value] : [] })}
            placeholder="e.g. Manager"
          />
        </div>
      )}

      {audience.mode === 'selected' && (
        <div className="space-y-2">
          <Label>Select Employees</Label>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {(employees ?? []).map((e) => (
              <label key={e.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={audience.employeeIds?.includes(e.id) ?? false}
                  onChange={(ev) => {
                    const current = audience.employeeIds ?? [];
                    const next = ev.target.checked
                      ? [...current, e.id]
                      : current.filter((id) => id !== e.id);
                    onChange({ ...audience, employeeIds: next });
                  }}
                />
                {e.fullName}
                {e.department && <span className="text-muted-foreground">({e.department})</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      {audience.mode === 'filter' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Department</Label>
            <Input
              value={audience.audienceFilter?.department ?? ''}
              onChange={(e) => onChange({
                ...audience,
                audienceFilter: { ...audience.audienceFilter, department: e.target.value, logic: 'AND' },
              })}
            />
          </div>
          <div className="space-y-2">
            <Label>Branch</Label>
            <Input
              value={audience.audienceFilter?.branch ?? ''}
              onChange={(e) => onChange({
                ...audience,
                audienceFilter: { ...audience.audienceFilter, branch: e.target.value, logic: 'AND' },
              })}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={audience.audienceFilter?.status ?? 'ACTIVE'}
              onValueChange={(v) => onChange({
                ...audience,
                audienceFilter: { ...audience.audienceFilter, status: v, logic: 'AND' },
              })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="ON_LEAVE">On Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

export function buildPayload(audience: RecipientAudience) {
  if (audience.mode === 'all') return { sendToAll: true };
  if (audience.mode === 'groups') return { groupIds: audience.groupIds };
  if (audience.mode === 'department') return { department: audience.department };
  if (audience.mode === 'branch') return { branch: audience.branch };
  if (audience.mode === 'role') return { roles: audience.roles };
  if (audience.mode === 'selected') return { employeeIds: audience.employeeIds };
  if (audience.mode === 'filter') return { audienceFilter: audience.audienceFilter };
  return {};
}
