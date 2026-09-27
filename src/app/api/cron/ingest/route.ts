import { authorizeRequest } from '@/lib/server/authorize';
import { isPersistenceAvailable, runIngestion } from '@/lib/ingestion/run-ingestion';

/**
 * Scheduler entry point for ingestion.
 *
 * Vercel cron jobs only issue GET requests, while `/api/ingest` takes a POST body, so this
 * route exists to make the scheduled scan reachable. The configuration and authorization
 * rules are identical: `CRON_SECRET` is required in production, and Vercel sends
 * `Authorization: Bearer $CRON_SECRET` automatically when that variable is set.
 *
 * `/api/ingest` remains the documented API and the right entry point for manual runs.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  const auth = authorizeRequest(request);
  if (!auth.ok) return Response.json(auth.body, { status: auth.status });

  if (!isPersistenceAvailable()) {
    return Response.json(
      {
        error:
          'Supabase is not configured on this deployment, so there is nowhere to store the scan. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      },
      { status: 503 }
    );
  }

  try {
    const report = await runIngestion({ dryRun: false });
    return Response.json(report);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Ingestion failed.' },
      { status: 500 }
    );
  }
}
