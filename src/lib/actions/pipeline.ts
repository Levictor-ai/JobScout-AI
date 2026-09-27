'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { runIngestion } from '@/lib/ingestion/run-ingestion';
import { runAnalysis, type AnalysisReport } from '@/lib/ai/run-analysis';
import { isAiConfigured } from '@/lib/ai/client';
import { notifyHighMatchJobs, type NotifyReport } from '@/lib/notifications/notify';
import { isTelegramConfigured } from '@/lib/notifications/telegram';
import type { IngestionReport } from '@/lib/ingestion/run-ingestion';

/**
 * Buttons that run the real pipeline. These spend network calls and OpenAI tokens,
 * so each one validates its own inputs and reports failures instead of throwing.
 */

export interface PipelineResult<T> {
  ok: boolean;
  message: string;
  report?: T;
}

function boundedInt(value: FormDataEntryValue | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export async function runIngestionAction(formData: FormData): Promise<PipelineResult<IngestionReport>> {
  const dryRun = formData.get('dryRun') !== 'false';
  const maxCompanies = boundedInt(formData.get('maxCompanies'), 12, 1, 25);
  const companyIds = String(formData.get('companyIds') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  try {
    const report = await runIngestion({
      dryRun,
      maxCompanies,
      companyIds,
      includeSamples: 0,
    });

    revalidatePath('/companies');

    return {
      ok: report.failedSources === 0,
      message: `${report.companiesScanned - report.failedSources}/${report.companiesScanned} sources ok, ${report.jobsFound} jobs, ${report.jobsNew} new, ${report.jobsUpdated} updated, ${report.failedSources} failed.`,
      report,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Ingestion failed.',
    };
  }
}

export async function runAnalysisAction(formData: FormData): Promise<PipelineResult<AnalysisReport>> {
  if (!isAiConfigured()) {
    return { ok: false, message: 'OPENAI_API_KEY is not configured.' };
  }

  const limit = boundedInt(formData.get('limit'), 5, 1, 50);
  const concurrency = boundedInt(formData.get('concurrency'), 2, 1, 6);
  const postedWithinDays = boundedInt(formData.get('postedWithinDays'), 30, 1, 365);
  const includeAllRoles = formData.get('includeAllRoles') === 'true';
  const pendingOnly = formData.get('pendingOnly') !== 'false';

  try {
    const report = await runAnalysis({
      mode: 'run',
      limit,
      concurrency,
      postedWithinDays,
      includeAllRoles,
      pendingOnly,
    });

    revalidatePath('/', 'layout');

    return {
      ok: report.failed === 0,
      message: `${report.jobsAnalyzed} analyzed, ${report.jobsMatched} matched, ${report.failed} failed, ${report.totalTokens} tokens.`,
      report,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Analysis failed.',
    };
  }
}

export async function sendTelegramAction(formData: FormData): Promise<PipelineResult<NotifyReport>> {
  if (!isTelegramConfigured()) {
    return { ok: false, message: 'TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are not configured.' };
  }

  if (!getSupabaseServerClient()) {
    return { ok: false, message: 'Supabase is not configured, so there are no matches to notify about yet.' };
  }

  const minScore = boundedInt(formData.get('minScore'), 80, 0, 100);
  const limit = boundedInt(formData.get('limit'), 10, 1, 25);
  const dryRun = formData.get('dryRun') === 'true';

  try {
    const report = await notifyHighMatchJobs({ minScore, limit, dryRun });
    return {
      ok: !report.skipped && report.failed === 0,
      message: report.skipped
        ? `Skipped: ${report.reason}`
        : `${report.notified} sent, ${report.considered - report.notified - report.failed} below threshold, ${report.failed} failed.`,
      report,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Notification failed.',
    };
  }
}
