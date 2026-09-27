import { DESCRIPTION_KEYWORDS, TARGET_TITLES, TOOL_KEYWORDS } from '@/data/target-profile';

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

  const matchedKeywords = DESCRIPTION_KEYWORDS.filter((keyword) => haystack.includes(normalize(keyword))).filter(
    (keyword) => !TOOL_KEYWORDS.some((tool) => tool.toLowerCase() === keyword)
  );
  const matchedTools = TOOL_KEYWORDS.filter((tool) => haystack.includes(normalize(tool)));

  const distinctHits = new Set([...matchedKeywords, ...matchedTools]).size;
  const score = Math.min(
    100,
    (matchedTitles.length > 0 ? TITLE_WEIGHT : 0) + Math.min(KEYWORD_CAP, distinctHits * KEYWORD_PER_HIT)
  );

  return { score, titleMatched: matchedTitles.length > 0, matchedTitles, matchedKeywords, matchedTools };
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
