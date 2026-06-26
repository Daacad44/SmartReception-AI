import * as XLSX from 'xlsx';
import { prisma } from '../../infrastructure/database/prisma';
import { ValidationError } from '../../core/errors';
import { normalizePhone, isValidPhone, isValidWhatsAppNumber } from '../../core/utils/phone';
import { assertEmployeeCreateAllowed } from './employee-limits.service';
import type { EmploymentType, EmployeeStatus } from '@prisma/client';

const HEADER_MAP: Record<string, string> = {
  name: 'fullName',
  'full name': 'fullName',
  'employee name': 'fullName',
  'full_name': 'fullName',
  phone: 'phone',
  'phone number': 'phone',
  mobile: 'phone',
  whatsapp: 'whatsappNumber',
  'whatsapp number': 'whatsappNumber',
  email: 'email',
  department: 'department',
  branch: 'branch',
  role: 'role',
  'job title': 'jobTitle',
  position: 'jobTitle',
  'employee id': 'employeeCode',
  'employee code': 'employeeCode',
  status: 'status',
  'employment type': 'employmentType',
  groups: 'groups',
  group: 'groups',
  tags: 'tags',
  notes: 'notes',
  'emergency contact': 'emergencyContact',
  language: 'language',
  timezone: 'timezone',
};

const STATUS_MAP: Record<string, EmployeeStatus> = {
  active: 'ACTIVE',
  inactive: 'INACTIVE',
  'on leave': 'ON_LEAVE',
  on_leave: 'ON_LEAVE',
  terminated: 'TERMINATED',
};

const EMPLOYMENT_MAP: Record<string, EmploymentType> = {
  'full time': 'FULL_TIME',
  full_time: 'FULL_TIME',
  'part time': 'PART_TIME',
  part_time: 'PART_TIME',
  contract: 'CONTRACT',
  intern: 'INTERN',
  temporary: 'TEMPORARY',
};

interface ParsedRow {
  fullName?: string;
  phone?: string;
  whatsappNumber?: string;
  email?: string;
  department?: string;
  branch?: string;
  role?: string;
  jobTitle?: string;
  employeeCode?: string;
  status?: EmployeeStatus;
  employmentType?: EmploymentType;
  groups?: string;
  tags?: string;
  notes?: string;
  emergencyContact?: string;
  language?: string;
  timezone?: string;
}

interface InvalidRecord {
  row: number;
  reason: string;
  data: Record<string, string>;
}

function parseCsv(buffer: Buffer): Record<string, string>[] {
  const text = buffer.toString('utf-8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
    if (Object.values(row).some((v) => v)) rows.push(row);
  }
  return rows;
}

function parseXlsx(buffer: Buffer): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
}

function mapRow(raw: Record<string, string>): ParsedRow {
  const mapped: ParsedRow = {};
  for (const [key, value] of Object.entries(raw)) {
    const field = HEADER_MAP[key.toLowerCase().trim()];
    if (field && value?.trim()) (mapped as Record<string, string>)[field] = value.trim();
  }
  if (mapped.status) mapped.status = STATUS_MAP[mapped.status.toLowerCase()] ?? mapped.status;
  if (mapped.employmentType) {
    mapped.employmentType = EMPLOYMENT_MAP[mapped.employmentType.toLowerCase()] ?? mapped.employmentType;
  }
  return mapped;
}

async function resolveGroupIds(businessId: string, groupNames: string[]): Promise<string[]> {
  if (!groupNames.length) return [];
  const groups = await prisma.employeeGroup.findMany({
    where: { businessId, name: { in: groupNames }, status: 'ACTIVE' },
    select: { id: true, name: true },
  });
  return groups.map((g) => g.id);
}

export class EmployeeImportService {
  async listJobs(businessId: string, limit = 20) {
    return prisma.employeeImportJob.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async getJob(businessId: string, id: string) {
    const job = await prisma.employeeImportJob.findFirst({
      where: { id, businessId },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!job) throw new ValidationError('Import job not found');
    return job;
  }

  async processUpload(businessId: string, userId: string, file: Express.Multer.File) {
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      throw new ValidationError('Unsupported file type. Use CSV or Excel (.xlsx)');
    }

    const job = await prisma.employeeImportJob.create({
      data: {
        businessId,
        fileName: file.originalname,
        fileType: ext,
        status: 'PROCESSING',
        createdById: userId,
      },
    });

    try {
      const rawRows = ext === 'csv' ? parseCsv(file.buffer) : parseXlsx(file.buffer);
      if (!rawRows.length) throw new ValidationError('File is empty or has no data rows');

      const seenPhones = new Set<string>();
      const existingPhones = new Set(
        (await prisma.employee.findMany({
          where: { businessId, isActive: true },
          select: { phone: true },
        })).map((e) => normalizePhone(e.phone))
      );

      let importedCount = 0;
      let duplicateCount = 0;
      let invalidCount = 0;
      const invalidRecords: InvalidRecord[] = [];

      for (let i = 0; i < rawRows.length; i++) {
        const row = mapRow(rawRows[i]);
        const rowNum = i + 2;

        if (!row.fullName?.trim()) {
          invalidCount++;
          invalidRecords.push({ row: rowNum, reason: 'Missing required field: full name', data: rawRows[i] });
          continue;
        }
        if (!row.phone?.trim()) {
          invalidCount++;
          invalidRecords.push({ row: rowNum, reason: 'Missing required field: phone', data: rawRows[i] });
          continue;
        }

        const phone = normalizePhone(row.phone);
        if (!isValidPhone(phone)) {
          invalidCount++;
          invalidRecords.push({ row: rowNum, reason: 'Invalid phone number', data: rawRows[i] });
          continue;
        }

        const whatsapp = normalizePhone(row.whatsappNumber || row.phone);
        if (!isValidWhatsAppNumber(whatsapp)) {
          invalidCount++;
          invalidRecords.push({ row: rowNum, reason: 'Invalid WhatsApp number', data: rawRows[i] });
          continue;
        }

        if (seenPhones.has(phone) || existingPhones.has(phone)) {
          duplicateCount++;
          continue;
        }

        try {
          await assertEmployeeCreateAllowed(businessId);
        } catch {
          invalidCount++;
          invalidRecords.push({ row: rowNum, reason: 'Employee plan limit reached', data: rawRows[i] });
          continue;
        }

        seenPhones.add(phone);
        existingPhones.add(phone);

        const groupNames = row.groups
          ? row.groups.split(/[,;]/).map((g) => g.trim()).filter(Boolean)
          : [];
        const groupIds = await resolveGroupIds(businessId, groupNames);
        const tagList = row.tags
          ? row.tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean)
          : [];

        await prisma.employee.create({
          data: {
            businessId,
            fullName: row.fullName.trim(),
            phone,
            whatsappNumber: whatsapp,
            email: row.email?.trim() || null,
            department: row.department,
            branch: row.branch,
            role: row.role,
            jobTitle: row.jobTitle,
            employeeCode: row.employeeCode,
            status: row.status ?? 'ACTIVE',
            employmentType: row.employmentType ?? 'FULL_TIME',
            tags: tagList,
            notes: row.notes,
            emergencyContact: row.emergencyContact,
            language: row.language ?? 'so',
            timezone: row.timezone,
            groupMembers: groupIds.length
              ? { create: groupIds.map((groupId) => ({ groupId })) }
              : undefined,
          },
        });
        importedCount++;
      }

      const report = { invalidRecords: invalidRecords.slice(0, 100) };
      await prisma.employeeImportJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          totalRows: rawRows.length,
          importedCount,
          duplicateCount,
          invalidCount,
          report: report as object,
          completedAt: new Date(),
        },
      });

      return { jobId: job.id, importedCount, duplicateCount, invalidCount, totalRows: rawRows.length, report };
    } catch (error) {
      await prisma.employeeImportJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', completedAt: new Date() },
      });
      throw error;
    }
  }

  async processPaste(businessId: string, userId: string, content: string) {
    const buffer = Buffer.from(content, 'utf-8');
    return this.processUpload(businessId, userId, {
      originalname: 'paste-import.csv',
      buffer,
    } as Express.Multer.File);
  }
}

export const employeeImportService = new EmployeeImportService();
