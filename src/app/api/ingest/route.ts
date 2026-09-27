import { authorizeRequest } from '@/lib/server/authorize';
import { isPersistenceAvailable, runIngestion } from '@/lib/ingestion/run-ingestion';
import { listSupportedSources } from '@/lib/sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(): Promise<Response> {
  return Response.json({
    endpoint: '/api/ingest',
    method: 'POST',
    supportedSources: listSupportedSources(),
    persistenceConfigured: isPersistenceAvailable(),
    env: {
      supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      cronSecret: Boolean(process.env.CRON_SECRET),
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const auth = authorizeRequest(request);
  if (!auth.ok) return Response.json(auth.body, { status: auth.status });

  let body: {
    dryRun?: boolean;
    companyIds?: string[];
    maxCompanies?: number;
    includeSamples?: number;
  };

  try {
    body = (await request.json()) ?? {};
  } catch {
    body = {};
  }

  if (body.companyIds !== undefined && !Array.isArray(body.companyIds)) {
    return Response.json({ error: 'companyIds must be an array of company ids.' }, { status: 400 });
  }

  try {
    const report = await runIngestion({
      dryRun: body.dryRun === true,
      companyIds: body.companyIds,
      maxCompanies: body.maxCompanies,
      includeSamples: body.includeSamples,
    });

    return Response.json(report);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Ingestion failed.' },
      { status: 500 }
    );
  }
}
