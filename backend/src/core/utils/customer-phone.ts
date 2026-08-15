import { prisma } from '../../infrastructure/database/prisma';
import type { Customer } from '@prisma/client';
import { normalizeEmail } from '../../infrastructure/appointments/email-validation';
import { normalizeSomaliPhone, phoneLast6, somaliPhonesMatch } from '@smartreception/shared';

export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * True when two phones refer to the same WhatsApp subscriber. Somali numbers are
 * matched on their LAST 6 digits (after normalizing +252 vs local formats).
 */
export function phonesMatchDigitized(a: string, b: string): boolean {
  return somaliPhonesMatch(a, b);
}

/**
 * Find a customer by phone regardless of formatting (+252, spaces, local vs
 * international). Matching is done on the last 6 digits of the stored number.
 */
export async function findCustomerByPhoneDigits(
  businessId: string,
  phone: string
): Promise<Customer | null> {
  const last6 = phoneLast6(normalizeSomaliPhone(phone));
  if (last6.length < 6) return null;

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM customers
    WHERE "businessId" = ${businessId}
      AND right(regexp_replace(phone, '[^0-9]', '', 'g'), 6) = ${last6}
    ORDER BY "createdAt" ASC
    LIMIT 1
  `;

  if (!rows[0]) return null;
  return prisma.customer.findUnique({ where: { id: rows[0].id } });
}

/** All customer IDs for a business that share the same WhatsApp phone (last-6 match). */
export async function findCustomerIdsByPhoneDigits(
  businessId: string,
  phone: string
): Promise<string[]> {
  const last6 = phoneLast6(normalizeSomaliPhone(phone));
  if (last6.length < 6) return [];

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM customers
    WHERE "businessId" = ${businessId}
      AND right(regexp_replace(phone, '[^0-9]', '', 'g'), 6) = ${last6}
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
