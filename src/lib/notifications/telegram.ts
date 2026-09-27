const TELEGRAM_API_BASE = 'https://api.telegram.org';

const REQUEST_TIMEOUT_MS = 15_000;

export interface TelegramSendResult {
  ok: boolean;
  messageId: number | null;
  error: string | null;
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function callTelegram(
  method: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; result?: { message_id?: number }; description?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      result?: { message_id?: number };
      description?: string;
    } | null;

    if (!response.ok || !body?.ok) {
      return {
        ok: false,
        description:
          body?.description ?? `Telegram API responded with status ${response.status}.`,
      };
    }

    return { ok: true, result: body.result };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendTelegramMessage(
  html: string,
  options: { disableWebPagePreview?: boolean; chatId?: string } = {}
): Promise<TelegramSendResult> {
  const chatId = options.chatId ?? process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return { ok: false, messageId: null, error: 'TELEGRAM_CHAT_ID is not configured.' };

  try {
    const response = await callTelegram('sendMessage', {
      chat_id: chatId,
      text: html,
      parse_mode: 'HTML',
      disable_web_page_preview: options.disableWebPagePreview ?? true,
    });

    if (!response.ok) {
      return { ok: false, messageId: null, error: response.description ?? 'Unknown Telegram error.' };
    }

    return { ok: true, messageId: response.result?.message_id ?? null, error: null };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === 'AbortError'
          ? 'Telegram request timed out.'
          : error.message
        : 'Unknown Telegram error.';
    return { ok: false, messageId: null, error: message };
  }
}

export interface MatchNotificationJob {
  id: string;
  title: string;
  companyName: string;
  location: string | null;
  remoteStatus: string;
  employmentType: string;
  seniority: string;
  applicationUrl: string;
  matchScore: number;
  matchingFactors: string[];
  skillGaps: string[];
  summary: string | null;
}

export function formatMatchNotification(job: MatchNotificationJob): string {
  const lines = [
    `<b>${escapeHtml(job.title)}</b>`,
    escapeHtml(job.companyName),
    '',
    `Match: <b>${job.matchScore}%</b>`,
  ];

  if (job.summary) lines.push('', escapeHtml(job.summary));

  const meta = [job.location ?? 'Location not specified', job.remoteStatus.replace('_', ' '), job.employmentType.replace('_', ' ')];
  lines.push('', `<i>${escapeHtml(meta.filter(Boolean).join(' • '))}</i>`);

  if (job.matchingFactors.length > 0) {
    lines.push('', '<b>Strong matches</b>');
    for (const factor of job.matchingFactors.slice(0, 5)) lines.push(`• ${escapeHtml(factor)}`);
  }

  if (job.skillGaps.length > 0) {
    lines.push('', '<b>Potential gaps</b>');
    for (const gap of job.skillGaps.slice(0, 3)) lines.push(`• ${escapeHtml(gap)}`);
  }

  lines.push('', `<a href="${escapeHtml(job.applicationUrl)}">View and apply</a>`);

  return lines.join('\n');
}

export function formatDigest(
  jobs: MatchNotificationJob[],
  options: { newJobCount: number; highMatchCount: number }
): string {
  const header = [
    '<b>JobScout AI</b>',
    `${options.newJobCount} new role${options.newJobCount === 1 ? '' : 's'} discovered, ${options.highMatchCount} strong match${options.highMatchCount === 1 ? '' : 'es'}.`,
  ];

  const body = jobs.map((job) => {
    const factors = job.matchingFactors[0] ? ` — ${escapeHtml(job.matchingFactors[0])}` : '';
    return `<b>${escapeHtml(job.title)}</b> (${job.matchScore}%)${factors}\n${escapeHtml(job.companyName)} · ${escapeHtml(job.location ?? 'Location not specified')}\n<a href="${escapeHtml(job.applicationUrl)}">View and apply</a>`;
  });

  return [...header, '', ...body].join('\n\n');
}

export async function sendTestMessage(): Promise<TelegramSendResult> {
  if (!isTelegramConfigured()) {
    return { ok: false, messageId: null, error: 'Telegram is not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).' };
  }

  return sendTelegramMessage(
    [
      '<b>JobScout AI</b>',
      '',
      'Telegram notifications are working.',
      'New roles are reported here when they clear your match threshold.',
      '',
      '<i>Sent from the server. The bot token is never exposed to the browser.</i>',
    ].join('\n')
  );
}
