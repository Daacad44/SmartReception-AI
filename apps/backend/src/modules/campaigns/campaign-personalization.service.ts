import type { Customer } from '@prisma/client';

export type PersonalizationContext = {
  businessName: string;
  customer: Pick<Customer, 'name' | 'phone' | 'email' | 'companyName' | 'city' | 'country'>;
  appointmentDate?: string;
  appointmentTime?: string;
  invoiceNumber?: string;
  discountCode?: string;
  customFields?: Record<string, string>;
};

const VARIABLE_MAP: Record<string, (ctx: PersonalizationContext) => string> = {
  customer_name: (ctx) => ctx.customer.name,
  name: (ctx) => ctx.customer.name,
  business_name: (ctx) => ctx.businessName,
  phone: (ctx) => ctx.customer.phone,
  email: (ctx) => ctx.customer.email ?? '',
  company: (ctx) => ctx.customer.companyName ?? '',
  appointment_date: (ctx) => ctx.appointmentDate ?? '',
  appointment_time: (ctx) => ctx.appointmentTime ?? '',
  invoice_number: (ctx) => ctx.invoiceNumber ?? '',
  discount_code: (ctx) => ctx.discountCode ?? '',
};

/** Replace {{variable}} placeholders with customer/business data. */
export function personalizeCampaignMessage(template: string, ctx: PersonalizationContext): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const lower = key.toLowerCase();
    if (VARIABLE_MAP[lower]) return VARIABLE_MAP[lower](ctx);
    if (ctx.customFields?.[lower]) return ctx.customFields[lower]!;
    return match;
  });
}

export function extractTemplateVariables(content: string): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
    found.add(match[1]!.toLowerCase());
  }
  return [...found];
}
