import { isValidSomaliPhone, normalizeSomaliPhone, somaliPhonesMatch } from '@smartreception/shared';

/** Display form for OS / in-app handoff alerts, e.g. "+252 61 2345678". */
export function formatAlertPhone(phone?: string | null): string {
  const trimmed = (phone ?? '').trim();
  if (!trimmed) return '';
  if (isValidSomaliPhone(trimmed)) {
    const canonical = normalizeSomaliPhone(trimmed);
    return `${canonical.slice(0, 4)} ${canonical.slice(4, 6)} ${canonical.slice(6)}`;
  }
  return trimmed;
}

/**
 * Body for "Human support needed" so staff can see who needs help
 * without opening the app. If the stored name is just the phone number
 * (WhatsApp fallback), show the phone once.
 */
export function formatCustomerAlertIdentity(
  name?: string | null,
  phone?: string | null
): string {
  const trimmedName = (name ?? '').trim();
  const displayPhone = formatAlertPhone(phone);
  const nameDigits = trimmedName.replace(/\D/g, '');
  const phoneDigits = (phone ?? '').replace(/\D/g, '');
  const nameIsJustPhone =
    nameDigits.length >= 6 &&
    (nameDigits === phoneDigits || (phone ? somaliPhonesMatch(trimmedName, phone) : false));
  const displayName = nameIsJustPhone ? '' : trimmedName;

  if (displayName && displayPhone) return `${displayName} · ${displayPhone}`;
  return displayName || displayPhone || 'Unknown customer';
}
