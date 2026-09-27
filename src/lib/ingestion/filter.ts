import { normalizeForDedupe } from '@/lib/ingestion/normalize';
import type { RoleCategory } from '@/lib/sources/types';

/**
 * Shared candidate filtering.
 *
 * These live here rather than inside the analysis orchestrator so the Telegram digest and
 * `POST /api/analyze` filter identically. Two copies of "is this a role I care about" is
 * how a digest ends up sending 200 irrelevant postings.
 */

export const TARGET_ROLE_CATEGORIES: RoleCategory[] = [
  'product_design',
  'ux_ui',
  'brand_design',
  'graphic_design',
  'web_design',
  'design_engineering',
  'product_engineering',
  'research',
];

export function withinDays(isoDate: string | null, days: number, now = Date.now()): boolean {
  if (!isoDate) return false;
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return false;
  return now - parsed <= days * 24 * 60 * 60 * 1000;
}

export function isTargetTitle(title: string, targetRoles: string[]): boolean {
  if (targetRoles.length === 0) return false;
  const haystack = normalizeForDedupe(title);
  return targetRoles.some((role) => {
    const needle = normalizeForDedupe(role);
    return needle.length > 2 && haystack.includes(needle);
  });
}

export function isTargetCandidate(
  title: string,
  roleCategory: RoleCategory,
  targetRoles: string[],
  includeAllRoles: boolean
): boolean {
  if (includeAllRoles) return true;
  if (TARGET_ROLE_CATEGORIES.includes(roleCategory)) return true;
  return isTargetTitle(title, targetRoles);
}
