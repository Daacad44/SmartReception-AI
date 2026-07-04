import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function formatCurrency(amount: unknown): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toNumber(amount));
}

export function formatNumber(num: unknown): string {
  return new Intl.NumberFormat('en-US').format(toNumber(num));
}

export function formatPercent(value: unknown): string {
  const n = toNumber(value);
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

export function getInitials(name: string | null | undefined): string {
  if (!name?.trim()) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}

/** Normalize message text for single-line inbox previews (keeps list items readable). */
export function formatMessagePreview(content: string | null | undefined, maxLength = 120): string {
  if (!content?.trim()) return '';
  const normalized = content
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const singleLine = normalized.replace(/\n+/g, ' · ');
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength).trimEnd()}…`;
}
