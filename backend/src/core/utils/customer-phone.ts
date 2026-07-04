import { prisma } from '../../infrastructure/database/prisma';
import type { Customer } from '@prisma/client';
import { normalizeEmail } from '../../infrastructure/appointments/email-validation';

export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** True when two phones refer to the same WhatsApp subscriber (handles +252 vs local). */
export function phonesMatchDigitized(a: string, b: string): boolean {
  const da = phoneDigits(a);
  const db = phoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  return da.endsWith(db) || db.endsWith(da);
}

/** Find a customer by phone regardless of formatting (+252, spaces, local vs international). */
export async function findCustomerByPhoneDigits(
  businessId: string,
  phone: string
): Promise<Customer | null> {
  const digits = phoneDigits(phone);
  if (!digits) return null;

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM customers
    WHERE "businessId" = ${businessId}
      AND (
        regexp_replace(phone, '[^0-9]', '', 'g') = ${digits}
        OR regexp_replace(phone, '[^0-9]', '', 'g') LIKE '%' || ${digits}
        OR ${digits} LIKE '%' || regexp_replace(phone, '[^0-9]', '', 'g')
      )
    ORDER BY "createdAt" ASC
    LIMIT 1
  `;

  if (!rows[0]) return null;
  return prisma.customer.findUnique({ where: { id: rows[0].id } });
}

/** All customer IDs for a business that share the same WhatsApp phone (suffix-safe). */
export async function findCustomerIdsByPhoneDigits(
  businessId: string,
  phone: string
): Promise<string[]> {
  const digits = phoneDigits(phone);
  if (!digits) return [];

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM customers
    WHERE "businessId" = ${businessId}
      AND (
        regexp_replace(phone, '[^0-9]', '', 'g') = ${digits}
        OR regexp_replace(phone, '[^0-9]', '', 'g') LIKE '%' || ${digits}
        OR ${digits} LIKE '%' || regexp_replace(phone, '[^0-9]', '', 'g')
      )
  `;

  return rows.map((row) => row.id);
}

/**
 * Resolve the customer record for a WhatsApp appointment.
 * Avoids unique-constraint failures when the conversation customer uses a different phone format.
 */
export async function resolveCustomerForAppointment(
  businessId: string,
  opts: {
    phone: string;
    name?: string;
    email?: string;
    fallbackCustomerId: string;
  }
): Promise<Customer | null> {
  const digits = phoneDigits(opts.phone);
  if (!digits) {
    return prisma.customer.findFirst({
      where: { id: opts.fallbackCustomerId, businessId, isActive: true },
    });
  }

  const matched = await findCustomerByPhoneDigits(businessId, opts.phone);
  const customer = matched
    ?? (await prisma.customer.findFirst({
      where: { id: opts.fallbackCustomerId, businessId, isActive: true },
    }));

  if (!customer) return null;

  const updates: { name?: string; email?: string } = {};
  if (opts.name?.trim()) updates.name = opts.name.trim();
  if (opts.email?.trim()) updates.email = normalizeEmail(opts.email);

  if (Object.keys(updates).length === 0) return customer;

  return prisma.customer.update({
    where: { id: customer.id },
    data: updates,
  });
}
