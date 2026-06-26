import type { Employee } from '@prisma/client';

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

export function personalizeEmployeeMessage(
  template: string,
  ctx: { businessName: string; employee: Pick<Employee, 'fullName' | 'jobTitle' | 'department' | 'branch' | 'email' | 'phone'> }
): string {
  const vars: Record<string, string> = {
    employee_name: ctx.employee.fullName,
    employee_full_name: ctx.employee.fullName,
    job_title: ctx.employee.jobTitle ?? '',
    department: ctx.employee.department ?? '',
    branch: ctx.employee.branch ?? '',
    email: ctx.employee.email ?? '',
    phone: ctx.employee.phone,
    business_name: ctx.businessName,
  };

  return template.replace(VARIABLE_PATTERN, (_, key: string) => vars[key] ?? `{{${key}}}`);
}
