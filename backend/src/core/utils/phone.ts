/** Normalize phone to digits with optional leading + */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  return hasPlus ? `+${digits}` : digits;
}

export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export function isValidWhatsAppNumber(phone: string): boolean {
  return isValidPhone(phone);
}
