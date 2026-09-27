import type { EmploymentType, RemoteStatus } from '@/types';

/**
 * Presentation helpers for the Telegram digest.
 *
 * Kept separate from the digest so salary, age, and location wording are decided once and
 * reused. Remote boards describe location in wildly different ways ("Anywhere", "US Only",
 * "Columbus, IN"), and normalising that in one place is the only way the output stays
 * consistent.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  GBP: 'Â£',
  EUR: 'â‚¬',
  CAD: 'C$',
  AUD: 'A$',
  NZD: 'NZ$',
  INR: 'â‚¹',
  BRL: 'R$',
  ZAR: 'R',
  MXN: 'MX$',
  SGD: 'S$',
  JPY: 'Â¥',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zÅ‚',
};

/** Codes that are conventionally written without minor units. */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK']);

function withSymbol(amount: number, currency: string | null): string {
  const code = (currency ?? '').trim().toUpperCase();  const decimals = ZERO_DECIMAL.has(code) || amount < 1000 ? 0 : 0;
  const grouped = amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const symbol = CURRENCY_SYMBOLS[code];
  return symbol ? `${symbol}${grouped}` : code ? `${grouped} ${code}` : grouped;
}

/**
 * Renders a pay range, or null when the board did not say.
 *
 * Many boards publish `0` or an empty string rather than omitting the field, so a zero is
 * treated as "not disclosed" instead of being formatted as "$0".
 */
export function formatSalary(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined
): string | null {
  const low = typeof min === 'number' && min > 0 ? min : null;
  const high = typeof max === 'number' && max > 0 ? max : null;
  const code = currency ?? null;

  if (low !== null && high !== null) {
    return high === low ? withSymbol(low, code) : `${withSymbol(low, code)}–${withSymbol(high, code)}`;
  }
  if (low !== null) return `From ${withSymbol(low, code)}`;
  if (high !== null) return `Up to ${withSymbol(high, code)}`;
  return null;
}

const REMOTE_LABELS: Record<RemoteStatus, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'Onsite',
  unknown: 'Remote',
};

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
};

const PLACEHOLDER_LOCATIONS = new Set(['', 'anywhere', 'worldwide', 'remote', 'n/a', 'na', '-', 'us only', 'usa']);

export function formatRemoteLabel(status: RemoteStatus): string {
  return REMOTE_LABELS[status] ?? 'Remote';
}

export function formatEmployment(value: EmploymentType | string): string {
  return EMPLOYMENT_LABELS[value as EmploymentType] ?? 'Full-time';
}

/** "Remote • UK / Worldwide", or just "Worldwide" when the board gave no usable place. */
export function formatLocationLine(remoteStatus: RemoteStatus, location: string | null): string {
  const place = (location ?? '').replace(/\s+/g, ' ').trim();
  const usable = !PLACEHOLDER_LOCATIONS.has(place.toLowerCase()) ? place : null;
  return usable ? `${formatRemoteLabel(remoteStatus)} • ${usable}` : formatRemoteLabel(remoteStatus);
}

/** "Posted 6 hours ago" */
export function formatPostedAge(isoDate: string | null, now = Date.now()): string {
  if (!isoDate) return 'Posted date unknown';

  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return 'Posted date unknown';

  const hours = Math.max(0, Math.round((now - parsed) / 3_600_000));
  if (hours < 1) return 'Posted just now';
  if (hours === 1) return 'Posted 1 hour ago';
  if (hours < 24) return `Posted ${hours} hours ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'Posted 1 day ago';
  if (days < 45) return `Posted ${days} days ago`;

  const months = Math.round(days / 30);
  return months === 1 ? 'Posted 1 month ago' : `Posted ${months} months ago`;
}
