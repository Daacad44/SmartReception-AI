/**
 * Somali (Somalia, +252) phone number helpers.
 *
 * Rules:
 *  - A valid number is ALWAYS +252 followed by a mobile prefix (61, 62, 63, 68)
 *    and then 7 digits, e.g. +252612345678 (9 digits after the country code).
 *  - Incoming numbers may arrive in local forms (0612345678, 612345678) or
 *    without the leading + (252612345678); these are normalized to +252XXXXXXXXX.
 *  - Two numbers are considered the same subscriber when their LAST 6 digits match.
 */

/** Canonical valid Somali mobile format, e.g. +252612345678. */
export const SOMALIA_PHONE_REGEX = /^\+252(61|62|63|68)\d{7}$/;

/** Allowed mobile prefixes after the +252 country code. */
export const SOMALIA_MOBILE_PREFIXES = ['61', '62', '63', '68'] as const;

/**
 * Normalize any Somali-ish input to the canonical +252XXXXXXXX form.
 * Examples:
 *   "0612345678"      -> "+252612345678"
 *   "612345678"       -> "+252612345678"   (already 9 local digits)
 *   "61234567"        -> "+25261234567"     (8 local digits: prefix + 6)
 *   "252612345678"    -> "+252612345678"
 *   "+252 61 234 5678"-> "+252612345678"
 * Non-Somali / unrecognized input is still returned in +<digits> form so the
 * validator below can reject it.
 */
export function normalizeSomaliPhone(raw: string): string {
  let digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return '';

  // Strip the country code / trunk prefixes down to the local subscriber part.
  if (digits.startsWith('252')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }

  return `+252${digits}`;
}

/** True only for a canonical, valid Somali mobile number (after normalization). */
export function isValidSomaliPhone(raw: string): boolean {
  return SOMALIA_PHONE_REGEX.test(normalizeSomaliPhone(raw));
}

/** Last 6 digits of any number — the matching key between stored and incoming. */
export function phoneLast6(raw: string): string {
  return (raw ?? '').replace(/\D/g, '').slice(-6);
}

/**
 * True when two numbers belong to the same subscriber: they match on their
 * last 6 digits (after normalization). Both must have at least 6 digits.
 */
export function somaliPhonesMatch(a: string, b: string): boolean {
  const la = phoneLast6(normalizeSomaliPhone(a));
  const lb = phoneLast6(normalizeSomaliPhone(b));
  if (la.length < 6 || lb.length < 6) return false;
  return la === lb;
}
