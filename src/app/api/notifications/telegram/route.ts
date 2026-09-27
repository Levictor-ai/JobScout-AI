import { notifyHighMatchJobs } from '@/lib/notifications/notify';
import { isTelegramConfigured, sendTestMessage } from '@/lib/notifications/telegram';
import { sendLiveDigest } from '@/lib/notifications/live-digest';
import { authorizeRequest } from '@/lib/server/authorize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json({
    endpoint: '/api/notifications/telegram',
    method: 'POST',
    configured: isTelegramConfigured(),
    bodies: {
      test: 'Send a connectivity test message.',
      digest: 'Send newly matched jobs above the match threshold. Pass { "dryRun": true } to preview. Needs Supabase and an OpenAI key.',
      live: 'Fetch live boards, filter to target roles, and send. Needs neither Supabase nor an OpenAI key. Pass { "dryRun": true } to preview.',
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const auth = authorizeRequest(request);
  if (!auth.ok) return Response.json(auth.body, { status: auth.status });

  let body: {
    mode?: string;
    dryRun?: boolean;
    minScore?: number;
    limit?: number;
    postedWithinDays?: number;
    maxCompanies?: number;
    includeAllRoles?: boolean;
  } = {};

  try {
    body = (await request.json()) ?? {};
  } catch {
    body = {};
  }

  const mode = body.mode ?? 'test';

  if (mode === 'test') {
    const result = await sendTestMessage();
    return Response.json(result, { status: result.ok ? 200 : 502 });
  }

  if (mode === 'live') {
    if (!isTelegramConfigured()) {
      return Response.json(
        { error: 'Telegram is not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).' },
        { status: 503 }
      );
    }

    const report = await sendLiveDigest({
      dryRun: body.dryRun === true,
      limit: body.limit,
      postedWithinDays: body.postedWithinDays,
      maxCompanies: body.maxCompanies,
      includeAllRoles: body.includeAllRoles === true,
    });
    return Response.json(report, { status: report.ok ? 200 : 502 });
  }

  if (mode === 'digest') {
    const report = await notifyHighMatchJobs({
      dryRun: body.dryRun === true,
      minScore: body.minScore,
      limit: body.limit,
    });
    return Response.json(report);
  }

  return Response.json(
    { error: `Unknown mode "${mode}". Use "test", "digest", or "live".` },
    { status: 400 }
  );
}
