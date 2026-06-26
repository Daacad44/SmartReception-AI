import * as XLSX from 'xlsx';
import { prisma } from '../../infrastructure/database/prisma';
import type { Prisma } from '@prisma/client';

export type ExportEmployeesInput = {
  format?: 'csv' | 'xlsx' | 'json';
  employeeIds?: string[];
  groupId?: string;
  department?: string;
  branch?: string;
  status?: string;
};

function toExportRow(employee: {
  employeeCode: string | null;
  fullName: string;
  phone: string;
  whatsappNumber: string | null;
  email: string | null;
  jobTitle: string | null;
  department: string | null;
  role: string | null;
  branch: string | null;
  status: string;
  employmentType: string;
  tags: string[];
  notes: string | null;
  emergencyContact: string | null;
  hireDate: Date | null;
  groupMembers?: Array<{ group: { name: string } }>;
}) {
  return {
    'Employee ID': employee.employeeCode ?? '',
    'Full Name': employee.fullName,
    Phone: employee.phone,
    WhatsApp: employee.whatsappNumber ?? '',
    Email: employee.email ?? '',
    'Job Title': employee.jobTitle ?? '',
    Department: employee.department ?? '',
    Role: employee.role ?? '',
    Branch: employee.branch ?? '',
    Status: employee.status,
    'Employment Type': employee.employmentType,
    Groups: employee.groupMembers?.map((m) => m.group.name).join('; ') ?? '',
    Tags: employee.tags.join('; '),
    Notes: employee.notes ?? '',
    'Emergency Contact': employee.emergencyContact ?? '',
    'Hire Date': employee.hireDate?.toISOString().slice(0, 10) ?? '',
  };
}

export class EmployeeExportService {
  async exportEmployees(businessId: string, input: ExportEmployeesInput) {
    const where: Prisma.EmployeeWhereInput = {
      businessId,
      isActive: true,
      ...(input.employeeIds?.length && { id: { in: input.employeeIds } }),
      ...(input.groupId && { groupMembers: { some: { groupId: input.groupId } } }),
      ...(input.department && { department: input.department }),
      ...(input.branch && { branch: input.branch }),
      ...(input.status && { status: input.status as never }),
    };

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { fullName: 'asc' },
      include: { groupMembers: { include: { group: { select: { name: true } } } } },
    });

    const rows = employees.map(toExportRow);
    const format = input.format ?? 'csv';

    if (format === 'json') {
      return {
        contentType: 'application/json',
        filename: `employees-${Date.now()}.json`,
        body: JSON.stringify(rows, null, 2),
      };
    }

    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Employees');

    if (format === 'xlsx') {
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      return {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `employees-${Date.now()}.xlsx`,
        body: buffer,
      };
    }

    const csv = XLSX.utils.sheet_to_csv(sheet);
    return {
      contentType: 'text/csv',
      filename: `employees-${Date.now()}.csv`,
      body: csv,
    };
  }

  async exportGroupMembers(businessId: string, groupId: string, format: 'csv' | 'xlsx' | 'json' = 'csv') {
    return this.exportEmployees(businessId, { format, groupId });
  }
}

export const employeeExportService = new EmployeeExportService();
