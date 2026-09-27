'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { runIngestionAction, runAnalysisAction, sendTelegramAction } from '@/lib/actions/pipeline';
import type { AppCapabilities } from '@/lib/data/capabilities';
import { Database, Sparkles, Send, Loader2 } from 'lucide-react';

interface PipelineRunnerProps {
  capabilities: AppCapabilities;
}

interface RunState {
  message: string;
  ok: boolean;
}

export function PipelineRunner({ capabilities }: PipelineRunnerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ingestion, setIngestion] = useState<RunState | null>(null);
  const [analysis, setAnalysis] = useState<RunState | null>(null);
  const [telegram, setTelegram] = useState<RunState | null>(null);

  const submit = (
    formData: FormData,
    action: (data: FormData) => Promise<{ ok: boolean; message: string }>,
    setState: (state: RunState) => void,
  ) => {
    setState({ message: 'Running…', ok: true });
    startTransition(async () => {
      const result = await action(formData);
      setState({ message: result.message, ok: result.ok });
      router.refresh();
    });
  };

  const tone = (state: RunState | null) =>
    state === null
      ? ''
      : state.ok
        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
        : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <form
        action={(formData) => submit(formData, runIngestionAction, setIngestion)}
        className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs space-y-3 h-fit"
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">1. Ingest job boards</h2>
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Reads the public Greenhouse and Ashby endpoints for every active company and upserts normalised roles.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Max companies</span>
            <input
              name="maxCompanies"
              type="number"
              min={1}
              max={25}
              defaultValue={12}
              className="mt-1 w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Mode</span>
            <select
              name="dryRun"
              defaultValue="false"
              className="mt-1 w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="false">Persist to Supabase</option>
              <option value="true">Dry run</option>
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full px-3 py-2 rounded-lg text-xs font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
          Run ingestion
        </button>

        {ingestion && <p className={`p-2.5 rounded-lg border text-[11px] ${tone(ingestion)}`}>{ingestion.message}</p>}
      </form>

      <form
        action={(formData) => submit(formData, runAnalysisAction, setAnalysis)}
        className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs space-y-3 h-fit"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">2. Analyse and match</h2>
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Classifies stored roles and scores them against your profile using {capabilities.model}. Each job costs
          tokens.
        </p>

        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Jobs</span>
            <input
              name="limit"
              type="number"
              min={1}
              max={50}
              defaultValue={5}
              className="mt-1 w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Parallel</span>
            <input
              name="concurrency"
              type="number"
              min={1}
              max={6}
              defaultValue={2}
              className="mt-1 w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Days</span>
            <input
              name="postedWithinDays"
              type="number"
              min={1}
              max={365}
              defaultValue={30}
              className="mt-1 w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <input type="checkbox" name="includeAllRoles" className="w-3.5 h-3.5 rounded border-zinc-300" />
          Include roles outside the target categories
        </label>

        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <input type="checkbox" name="pendingOnly" defaultChecked className="w-3.5 h-3.5 rounded border-zinc-300" />
          Only score jobs with no current match
        </label>

        <button
          type="submit"
          disabled={pending || !capabilities.openai}
          className="w-full px-3 py-2 rounded-lg text-xs font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {capabilities.openai ? 'Run analysis' : 'Set OPENAI_API_KEY first'}
        </button>

        {analysis && <p className={`p-2.5 rounded-lg border text-[11px] ${tone(analysis)}`}>{analysis.message}</p>}
      </form>

      <form
        action={(formData) => submit(formData, sendTelegramAction, setTelegram)}
        className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs space-y-3 h-fit"
      >
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-sky-500" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">3. Send Telegram digest</h2>
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Sends every stored match at or above the threshold that has not been notified yet.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Min score</span>
            <input
              name="minScore"
              type="number"
              min={0}
              max={100}
              defaultValue={80}
              className="mt-1 w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Max jobs</span>
            <input
              name="limit"
              type="number"
              min={1}
              max={25}
              defaultValue={10}
              className="mt-1 w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={pending || !capabilities.telegram}
          className="w-full px-3 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {capabilities.telegram ? 'Send digest' : 'Set Telegram credentials first'}
        </button>

        {telegram && <p className={`p-2.5 rounded-lg border text-[11px] ${tone(telegram)}`}>{telegram.message}</p>}
      </form>
    </div>
  );
}
