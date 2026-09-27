import {
  DESCRIPTION_KEYWORDS,
  DESIGN_SIGNALS,
  TARGET_TITLES,
  TARGET_TITLE_TIERS,
  TOOL_KEYWORDS,
} from '@/data/target-profile';

/**
 * Keyword relevance, used to rank jobs in the live digest.
 *
 * This is deliberately simple and inspectable rather than clever. It is NOT an AI match
 * score and never claims to be one: it reports which of the user's own target titles and
 * keywords literally appear in the posting. Anything subtler belongs in the AI matcher,
 * which needs an OpenAI key and a stored profile.
 */

export interface RelevanceResult {
  /** 0-100, title dominates. Comparable within one run, not across profiles. */
  score: number;
  titleMatched: boolean;
  /** True when the only title hit was an engineering-flavoured builder title. */
  builderOnly: boolean;
  matchedTitles: string[];
  matchedKeywords: string[];
  matchedTools: string[];
}

const TITLE_WEIGHT = 70;
const KEYWORD_CAP = 30;
const KEYWORD_PER_HIT = 3;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Two titles match when one contains the other after normalization, but only for phrases
 * long enough to be meaningful. Without the length guard, "AI" or "Web" would match half
 * the internet.
 */
function titleMatches(candidate: string, target: string): boolean {
  const needle = normalize(target);
  if (needle.length < 3) return false;
  return candidate === needle || candidate.includes(needle) || needle.includes(candidate);
}

export function scoreRelevance(title: string, description: string | null): RelevanceResult {
  const normalizedTitle = normalize(title);
  const haystack = normalize(`${title} ${description ?? ''}`);

  const matchedTitles = TARGET_TITLES.filter((target) => titleMatches(normalizedTitle, target));
  const builderOnly = matchedTitles.length > 0 && matchedTitles.every((t) => TARGET_TITLE_TIERS.get(t) === 'builder');

  const matchedKeywords = DESCRIPTION_KEYWORDS.filter((keyword) => haystack.includes(normalize(keyword))).filter(
    (keyword) => !TOOL_KEYWORDS.some((tool) => tool.toLowerCase() === keyword)
  );
  const matchedTools = TOOL_KEYWORDS.filter((tool) => haystack.includes(normalize(tool)));

  const distinctHits = new Set([...matchedKeywords, ...matchedTools]).size;
  const score = Math.min(
    100,
    (matchedTitles.length > 0 ? TITLE_WEIGHT : 0) + Math.min(KEYWORD_CAP, distinctHits * KEYWORD_PER_HIT)
  );

  return { score, titleMatched: matchedTitles.length > 0, builderOnly, matchedTitles, matchedKeywords, matchedTools };
}

/** True when the posting actually describes design work. */
export function hasDesignSignal(title: string, description: string | null): boolean {
  return countDesignSignals(title, description) > 0;
}

/**
 * Counts distinct design signals.
 *
 * One incidental hit is not evidence. These descriptions run 20,000 characters, so a single
 * "wireframing" mention while collaborating with designers is normal for a backend role. A
 * builder-tier title therefore has to clear a threshold rather than pass on one word.
 */
export function countDesignSignals(title: string, description: string | null): number {
  const haystack = normalize(`${title} ${description ?? ''}`);
  return DESIGN_SIGNALS.filter((signal) => haystack.includes(normalize(signal))).length;
}

/** Short human-readable reason, for the digest line. */
export function describeRelevance(result: RelevanceResult): string {
  if (result.matchedTitles.length > 0) return `title: ${result.matchedTitles[0]}`;

  const tools = result.matchedTools.slice(0, 2);
  if (tools.length > 0) return `uses ${tools.join(', ')}`;

  const keywords = result.matchedKeywords.slice(0, 2);
  if (keywords.length > 0) return `asks for ${keywords.join(', ')}`;

  return 'remote and recent';
}
