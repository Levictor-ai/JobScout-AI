'use client';

import React, { useState, useTransition } from 'react';
import type { CompanyWithStatus } from '@/lib/data/queries';
import { addCompanyAction, setCompanyActiveAction } from '@/lib/actions/profile';
import { Building2, CheckCircle2, AlertTriangle, Plus, PauseCircle, PlayCircle, ExternalLink } from 'lucide-react';

interface CompanyManagerProps {
  companies: CompanyWithStatus[];
  dataSource: 'database' | 'demo';
}

function relativeTime(value: string | null): string {
  if (!value) return 'never';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function CompanyManager({ companies, dataSource }: CompanyManagerProps) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const readOnly = dataSource === 'demo';

  const toggleActive = (company: CompanyWithStatus) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await setCompanyActiveAction(company.id, !company.active);
      setFeedback(result.message);
    });
  };

  const addCompany = (formData: FormData) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await addCompanyAction(formData);
      setFeedback(result.message);
    });
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs font-medium">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-2.5">
          {companies.length === 0 && (
            <div className="p-8 sm:p-10 text-center rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800">
              <Building2 className="w-7 h-7 text-zinc-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No companies configured</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Add a board token on the right, or apply the default list with an ingestion run.
              </p>
            </div>
          )}

          {companies.map((company) => (
            <div
              key={company.id}
              className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs flex items-center gap-4"
            >
              <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-700 dark:text-zinc-200 uppercase shrink-0">
                {company.name.slice(0, 2)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{company.name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-mono uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                    {company.ats_type}
                  </span>
                  {!company.active && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                      paused
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono truncate">
                  {company.ats_identifier}
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
                {company.lastError ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span className="max-w-[10rem] sm:max-w-[16rem] truncate">{company.lastError}</span>
                  </>
                ) : company.lastSuccessAt ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{relativeTime(company.lastSuccessAt)}</span>
                  </>
                ) : (
                  <span>not scanned yet</span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 w-12 text-right">
                  {company.jobCount} jobs
                </span>
                {company.careers_url && (
                  <a
                    href={company.careers_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  onClick={() => toggleActive(company)}
                  disabled={readOnly || pending}
                  title={readOnly ? 'Connect Supabase to manage companies' : company.active ? 'Pause' : 'Resume'}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  {company.active ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        <form action={addCompany} className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs h-fit space-y-3">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Add a company</h2>
          </div>

          <label className="block">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Company name</span>
            <input
              name="name"
              required
              placeholder="e.g. Ramp"
              className="mt-1 w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">ATS</span>
            <select
              name="atsType"
              className="mt-1 w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="greenhouse">Greenhouse</option>
              <option value="ashby">Ashby</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Board token</span>
            <input
              name="atsIdentifier"
              required
              placeholder="greenhouse slug or ashby org"
              className="mt-1 w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="block mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
              Greenhouse: the slug in boards.greenhouse.io/&lt;token&gt;. Ashby: the org in jobs.ashbyhq.com/&lt;token&gt;.
            </span>
          </label>

          <button
            type="submit"
            disabled={readOnly || pending}
            className="w-full px-3 py-2 rounded-lg text-xs font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 disabled:opacity-50"
          >
            {readOnly ? 'Connect Supabase first' : 'Add company'}
          </button>
        </form>
      </div>
    </div>
  );
}
