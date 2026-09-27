import type { EmploymentType, RemoteStatus, SeniorityLevel } from '@/types';
import type { RoleCategory } from '@/lib/sources/types';

const REMOTE_PATTERNS = [
  /\bremote\b/i,
  /\bwork from home\b/i,
  /\banywhere\b/i,
  /\bworldwide\b/i,
  /\bvirtual\b/i,
  /\bdistributed\b/i,
  /\btelecommute\b/i,
];

const HYBRID_PATTERNS = [/\bhybrid\b/i, /\bflexible location\b/i];

const ONSITE_PATTERNS = [
  /\bon-?site\b/i,
  /\bin[- ]office\b/i,
  /\bin person\b/i,
];

const RESTRICTED_REMOTE_PATTERNS = [
  /\bremote\s*[-–—(]/i,
  /\bremote\s*\(/i,
  /\bremote\s+only\s+(in|within)\b/i,
];

export function inferRemoteStatus(
  location: string | null,
  hints: { isRemote?: boolean | null; workplaceType?: string | null } = {}
): RemoteStatus {
  if (hints.isRemote === true) return 'remote';
  if (hints.isRemote === false && hints.workplaceType == null) return 'unknown';

  const workplace = hints.workplaceType?.toLowerCase() ?? '';
  if (workplace.includes('remote')) return 'remote';
  if (workplace.includes('hybrid')) return 'hybrid';
  if (workplace.includes('onsite') || workplace.includes('on-site')) return 'onsite';

  if (!location) return 'unknown';

  const hasRemote = REMOTE_PATTERNS.some((pattern) => pattern.test(location));
  const hasHybrid = HYBRID_PATTERNS.some((pattern) => pattern.test(location));
  const hasOnsite = ONSITE_PATTERNS.some((pattern) => pattern.test(location));

  if (hasRemote) return 'remote';
  if (hasHybrid) return 'hybrid';
  if (hasOnsite) return 'onsite';
  return 'unknown';
}

export function isRemoteRestricted(location: string | null): boolean {
  if (!location) return false;
  return RESTRICTED_REMOTE_PATTERNS.some((pattern) => pattern.test(location));
}

const EMPLOYMENT_PATTERNS: Array<[EmploymentType, RegExp[]]> = [
  ['internship', [/\bintern(ship)?\b/i, /\bco-?op\b/i, /\bplacement\b/i, /\bapprentice/i]],
  ['part_time', [/\bpart[\s-]?time\b/i]],
  ['contract', [/\bcontract(or)?\b/i, /\bfreelance\b/i, /\btemporary\b/i, /\bfixed[\s-]?term\b/i, /\bconsultant\b/i]],
];

export function inferEmploymentType(
  title: string,
  rawHint: string | null = null
): EmploymentType {
  const haystack = `${rawHint ?? ''} ${title}`;

  for (const [type, patterns] of EMPLOYMENT_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(haystack))) return type;
  }

  return 'full_time';
}

const SENIORITY_PATTERNS: Array<[SeniorityLevel, RegExp]> = [
  ['internship', /\b(intern|internship|co-?op|apprentice|placement)\b/i],
  ['principal', /\b(principal|distinguished|staff|principal engineer)\b/i],
  ['director', /\b(director|vp|vice president|head of)\b/i],
  ['lead', /\b(lead|manager|supervisor)\b/i],
  ['senior', /\b(senior|sr\.?|iii)\b/i],
  ['junior', /\b(junior|jr\.?|entry[\s-]?level|graduate)\b/i],
  ['mid', /\b(mid[\s-]?level|intermediate)\b/i],
];

export function inferSeniority(title: string, department: string | null = null): SeniorityLevel {
  const haystack = department ? `${title} ${department}` : title;

  if (/\b(intern|internship|co-?op|apprentice|placement)\b/i.test(haystack)) return 'internship';
  if (/\b(principal|distinguished)\b/i.test(haystack)) return 'principal';
  if (/\b(director|vp|vice president|head of)\b/i.test(haystack)) return 'director';
  if (/\b(lead|manager)\b/i.test(haystack)) return 'lead';
  if (/\b(senior|sr\.?)\b/i.test(haystack)) return 'senior';
  if (/\b(junior|jr\.?|entry[\s-]?level|graduate)\b/i.test(haystack)) return 'junior';
  if (/\b(mid[\s-]?level|intermediate)\b/i.test(haystack)) return 'mid';

  for (const [level, pattern] of SENIORITY_PATTERNS) {
    if (pattern.test(haystack)) return level;
  }

  return 'unknown';
}

const ROLE_PATTERNS: Array<[RoleCategory, RegExp]> = [
  ['design_engineering', /\b(design engineer|design technologist|frontend engineer|front-end engineer|creative technologist|creative developer)\b/i],
  ['product_engineering', /\b(product engineer|software engineer|software developer|full[\s-]?stack engineer|platform engineer|backend engineer|web developer)\b/i],
  ['research', /\b(user researcher|ux researcher|product researcher|design researcher|researcher)\b/i],
  ['ux_ui', /\b(ux|ui|user experience|user interface|interaction designer)\b/i],
  ['brand_design', /\b(brand|art director|creative director|visual designer|illustrator)\b/i],
  ['graphic_design', /\b(graphic|visual identity|print|motion|video designer|content designer)\b/i],
  ['web_design', /\b(web designer|web design|wordpress|shopify|webflow|landing page)\b/i],
  ['product_design', /\b(designer|design|ux|ui|figma|prototype)\b/i],
];

export function inferRoleCategory(title: string, department: string | null = null): RoleCategory {
  const haystack = department ? `${title} ${department}` : title;

  for (const [category, pattern] of ROLE_PATTERNS) {
    if (pattern.test(haystack)) return category;
  }

  return 'other';
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeForDedupe(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
