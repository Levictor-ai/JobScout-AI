import { authorizeRequest } from '@/lib/server/authorize';
import { resolveDigestStore } from '@/lib/notifications/digest-store';
import { sendLiveDigest } from '@/lib/notifications/live-digest';

/**
 * Scheduler entry point for the live Telegram digest.
 *
 * `/api/notifications/telegram` takes a POST body and is the right entry point for manual runs.
 * Schedulers are simpler with a GET, and this route is what the hourly GitHub Actions job calls:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://job-scout-ai-rho.vercel.app/api/cron/digest
 *
 * The defaults here are deliberately the strict ones rather than the permissive ones the manual
 * route exposes: last 3 days, remote only, product-design-first, and a minimum profile score.
 * A scheduled run nobody is watching must not fall back to "send everything that is remote".
 *
 * Every option can be overridden per call for testing, e.g. `?dryRun=1` to inspect the run
 * without sending or marking anything.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export async function GET(request: Request): Promise<Response> {
  const auth = authorizeRequest(request);
  if (!auth.ok) return Response.json(auth.body, { status: auth.status });

  const params = new URL(request.url).searchParams;
  const param = (key: string) => params.get(key);
  const dryRun = param('dryRun') === '1' || param('dryRun') === 'true';

  try {
    // Resolved before the digest runs so a missing dedupe table is visible in the report rather
    // than discovered halfway through sending.
    const store = await resolveDigestStore();

    const result = await sendLiveDigest({
      postedWithinDays: positiveInt(param('days'), 3),
      requireRemote: param('remote') !== '0',
      allowHybrid: param('hybrid') === '1',
      minRelevance: positiveInt(param('minRelevance'), 10),
      requireTitleMatch: param('requireTitleMatch') === '1',
      designFirst: param('designFirst') !== '0',
      maxTotal: positiveInt(param('maxTotal'), 25),
      dryRun,
      store,
    });

    // A run that found nothing new is a success. A run that tried to send and failed is not, so
    // the scheduler surfaces it instead of reporting a green tick.
    const failed = !result.ok && result.newRoles > 0;

    return Response.json(
      {
        ok: !failed,
        dryRun: result.dryRun,
        dedupeStore: result.dedupeStore,
        boardsScanned: result.boardsScanned,
        jobsFetched: result.jobsFetched,
        fromAggregators: result.fromAggregators,
        matchedTargetRoles: result.matchedTargetRoles,
        droppedNotRecent: result.droppedNotRecent,
        droppedNotRemote: result.droppedNotRemote,
        droppedOffProfile: result.droppedOffProfile,
        droppedNotDesign: result.droppedNotDesign,
        alreadySent: result.alreadySent,
        newRoles: result.newRoles,
        heldBack: result.heldBack,
        messagesSent: result.messagesSent,
        failedMessages: result.failedMessages,
        stateWritten: result.stateWritten,
        stateError: result.stateError,
        sourceCounts: result.sourceCounts,
        sourceFailures: result.sourceFailures,
        error: result.error,
        jobs: result.jobs.map(row => ({
          title: row.title,
          company: row.company,
          applicationUrl: row.applicationUrl,
          relevance: row.relevance,
        })),
      },
      { status: failed ? 502 : 200 }
    );
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'Digest failed.' },
      { status: 500 }
    );
  }
}
