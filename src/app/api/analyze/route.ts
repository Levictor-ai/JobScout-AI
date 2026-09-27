import { getModel, isAiConfigured } from '@/lib/ai/client';
import { runAnalysis } from '@/lib/ai/run-analysis';
import type { MatchProfileInput } from '@/lib/ai/prompts';
import { isPersistenceAvailable } from '@/lib/ingestion/run-ingestion';
import { authorizeRequest } from '@/lib/server/authorize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(): Promise<Response> {
  return Response.json({
    endpoint: '/api/analyze',
    method: 'POST',
    aiConfigured: isAiConfigured(),
    model: getModel(),
    persistenceConfigured: isPersistenceAvailable(),
    modes: {
      preview: 'Fetch live jobs and run the AI without writing to the database.',
      run: 'Read pending jobs from the database, run the AI, and write results back.',
      inspectPrompts: 'Return the exact messages that would be sent, without calling OpenAI.',
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const auth = authorizeRequest(request);
  if (!auth.ok) return Response.json(auth.body, { status: auth.status });

  let body: {
    mode?: 'preview' | 'run';
    inspectPrompts?: boolean;
    limit?: number;
    postedWithinDays?: number;
    concurrency?: number;
    includeAllRoles?: boolean;
    pendingOnly?: boolean;
    maxCompanies?: number;
    companyIds?: string[];
    profile?: Partial<MatchProfileInput>;
  };

  try {
    body = (await request.json()) ?? {};
  } catch {
    body = {};
  }

  if (body.mode === 'run' && !isAiConfigured()) {
    return Response.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 503 });
  }

  if (body.mode !== 'run' && !body.inspectPrompts && !isAiConfigured()) {
    return Response.json(
      { error: 'OPENAI_API_KEY is not configured. Use inspectPrompts to review the prompts instead.' },
      { status: 503 }
    );
  }

  try {
    const report = await runAnalysis({
      mode: body.mode,
      inspectPrompts: body.inspectPrompts === true,
      limit: body.limit,
      postedWithinDays: body.postedWithinDays,
      concurrency: body.concurrency,
      includeAllRoles: body.includeAllRoles,
      pendingOnly: body.pendingOnly,
      maxCompanies: body.maxCompanies,
      companyIds: body.companyIds,
      profile: body.profile,
    });

    return Response.json(report);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Analysis failed.' },
      { status: 500 }
    );
  }
}
