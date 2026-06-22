import * as XLSX from 'xlsx';
import { prisma } from '../../infrastructure/database/prisma';
import { ValidationError } from '../../core/errors';
import { billingService } from '../billing/billing.service';
import { normalizePhone, isValidPhone, isValidWhatsAppNumber } from '../../core/utils/phone';
import type { CustomerType } from '@prisma/client';

const HEADER_MAP: Record<string, string> = {
  name: 'name',
  'full name': 'name',
  'customer name': 'name',
  phone: 'phone',
  'phone number': 'phone',
  mobile: 'phone',
  tel: 'phone',
  whatsapp: 'whatsappNumber',
  'whatsapp number': 'whatsappNumber',
  'wa number': 'whatsappNumber',
  email: 'email',
  'e-mail': 'email',
  company: 'companyName',
  'company name': 'companyName',
  organization: 'companyName',
  address: 'address',
  city: 'city',
  country: 'country',
  type: 'customerType',
  'customer type': 'customerType',
  notes: 'notes',
  note: 'notes',
  tags: 'tags',
  tag: 'tags',
};

const CUSTOMER_TYPE_MAP: Record<string, CustomerType> = {
  vip: 'VIP',
  regular: 'REGULAR',
  new: 'NEW_CUSTOMER',
  'new customer': 'NEW_CUSTOMER',
  returning: 'RETURNING',
  'returning customer': 'RETURNING',
  premium: 'PREMIUM',
  'high value': 'HIGH_VALUE',
  high_value: 'HIGH_VALUE',
  inactive: 'INACTIVE',
  lead: 'LEAD',
  leads: 'LEAD',
  prospect: 'PROSPECT',
  prospects: 'PROSPECT',
};

interface ParsedRow {
  name?: string;
  phone?: string;
  whatsappNumber?: string;
  email?: string;
  companyName?: string;
  address?: string;
  city?: string;
  country?: string;
  customerType?: CustomerType;
  notes?: string;
  tags?: string;
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
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
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
    if (field && value?.trim()) {
      (mapped as Record<string, string>)[field] = value.trim();
    }
  }
  if (mapped.customerType) {
    const typeKey = mapped.customerType.toLowerCase();
    mapped.customerType = CUSTOMER_TYPE_MAP[typeKey] ?? (mapped.customerType as CustomerType);
  }
  return mapped;
}

export class CustomerImportService {
  async listJobs(businessId: string, limit = 20) {
    return prisma.customerImportJob.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async getJob(businessId: string, id: string) {
    const job = await prisma.customerImportJob.findFirst({
      where: { id, businessId },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!job) throw new ValidationError('Import job not found');
    return job;
  }

  async processUpload(
    businessId: string,
    userId: string,
    file: Express.Multer.File
  ) {
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      throw new ValidationError('Unsupported file type. Use CSV or Excel (.xlsx)');
    }

    const job = await prisma.customerImportJob.create({
      data: {
        businessId,
        fileName: file.originalname,
        fileType: ext,
        status: 'PROCESSING',
        createdById: userId,
      },
    });

    try {
      const rawRows =
        ext === 'csv' ? parseCsv(file.buffer) : parseXlsx(file.buffer);

      if (rawRows.length === 0) {
        throw new ValidationError('File is empty or has no data rows');
      }

      const seenPhones = new Set<string>();
      const existingPhones = new Set(
        (await prisma.customer.findMany({
          where: { businessId },
          select: { phone: true },
        })).map((c) => normalizePhone(c.phone))
      );

      let importedCount = 0;
      let duplicateCount = 0;
      let invalidCount = 0;
      const invalidRecords: InvalidRecord[] = [];

      for (let i = 0; i < rawRows.length; i++) {
        const row = mapRow(rawRows[i]);
        const rowNum = i + 2;

        if (!row.name?.trim()) {
          invalidCount++;
          invalidRecords.push({ row: rowNum, reason: 'Missing required field: name', data: rawRows[i] });
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
          await billingService.assertWithinLimit(businessId, 'customers');
        } catch {
          invalidCount++;
          invalidRecords.push({ row: rowNum, reason: 'Customer limit reached', data: rawRows[i] });
          continue;
        }

        seenPhones.add(phone);
        existingPhones.add(phone);

        const tagNames = row.tags
          ? row.tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean)
          : [];

        const customer = await prisma.customer.create({
          data: {
            businessId,
            name: row.name.trim(),
            phone,
            whatsappNumber: whatsapp,
            email: row.email?.trim() || null,
            companyName: row.companyName?.trim() || null,
            address: row.address?.trim() || null,
            city: row.city?.trim() || null,
            country: row.country?.trim() || null,
            customerType: row.customerType ?? 'REGULAR',
            notes: row.notes?.trim() || null,
            source: 'IMPORT',
          },
        });

        if (tagNames.length > 0) {
          for (const tagName of tagNames) {
            const tag = await prisma.customerTag.upsert({
              where: { businessId_name: { businessId, name: tagName } },
              create: { businessId, name: tagName },
              update: {},
            });
            await prisma.customerTagAssignment.upsert({
              where: { customerId_tagId: { customerId: customer.id, tagId: tag.id } },
              create: { customerId: customer.id, tagId: tag.id },
              update: {},
            });
          }
        }

        importedCount++;
      }

      const report = {
        totalRows: rawRows.length,
        importedCount,
        duplicateCount,
        invalidCount,
        invalidRecords: invalidRecords.slice(0, 50).map((r) => ({
          row: r.row,
          reason: r.reason,
          data: r.data,
        })),
      } as object;

      const updated = await prisma.customerImportJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          totalRows: rawRows.length,
          importedCount,
          duplicateCount,
          invalidCount,
          report,
          completedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'IMPORT',
          entity: 'Customer',
          entityId: job.id,
          newData: report,
        },
      });

      return updated;
    } catch (error) {
      await prisma.customerImportJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          report: { error: error instanceof Error ? error.message : 'Import failed' },
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }
}

export const customerImportService = new CustomerImportService();
