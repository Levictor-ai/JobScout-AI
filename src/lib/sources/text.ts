const BLOCK_BOUNDARY = /<\/?(p|div|section|article|header|footer|main|aside|ul|ol|li|table|tr|h[1-6]|blockquote|pre|figure)\b[^>]*>/gi;
const BREAK = /<br\s*\/?>/gi;
const REMOVED = /<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi;
const TAGS = /<[^>]+>/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '-',
  mdash: '-',
  hellip: '...',
  rsquo: "'",
  lsquo: "'",
  ldquo: '"',
  rdquo: '"',
  bull: '- ',
  middot: '-',
  copy: '(c)',
  reg: '(r)',
  trade: '(tm)',
  eacute: 'e',
  egrave: 'e',
  deg: ' deg',
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    const named = NAMED_ENTITIES[entity.toLowerCase()];
    return named ?? match;
  });
}

function stripTags(input: string): string {
  return input
    .replace(REMOVED, ' ')
    .replace(BREAK, '\n')
    .replace(BLOCK_BOUNDARY, '\n')
    .replace(TAGS, ' ');
}

function looksLikeMarkup(input: string): boolean {
  return /<[a-z!/][^>]*>/i.test(input);
}

function looksEscaped(input: string): boolean {
  return /&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-f]+);/i.test(input);
}

function tidy(input: string): string {
  return input
    .replace(/\r/g, '')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/**
 * Converts ATS HTML descriptions into readable plain text without adding a dependency.
 * Boards are inconsistent: some return raw markup, others (Figma on Greenhouse) return
 * escaped markup, so decode and strip repeat until neither tags nor entities remain.
 * Remote content is untrusted input: it is treated as text only, never rendered as markup.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';

  let working = decodeEntities(html);
  let stripped = stripTags(working);

  for (let pass = 0; pass < 3; pass += 1) {
    if (!looksLikeMarkup(stripped) && !looksEscaped(stripped)) return tidy(stripped);
    working = decodeEntities(stripTags(working));
    stripped = stripTags(working);
  }

  return tidy(stripped);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}
