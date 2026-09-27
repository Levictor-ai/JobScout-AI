'use client';

import React, { useState, useTransition } from 'react';
import type { Application, ApplicationStatus, JobWithDetails } from '@/types';
import { setApplicationStatus, updateApplicationNotes } from '@/lib/actions/jobs';
import { Briefcase, ExternalLink, Save, Sparkles } from 'lucide-react';

interface ApplicationBoardProps {
  rows: Array<{ application: Application; job: JobWithDetails }>;
  readOnly: boolean;
}

const STATUS_FLOW: ApplicationStatus[] = [
  'saved',
  'applying',
  'applied',
  'assessment',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
  'archived',
];

const STATUS_TONE: Record<string, string> = {
  saved: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  applying: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  applied: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
  assessment: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  interview: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300',
  offer: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  rejected: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  withdrawn: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  archived: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
};

interface Draft {
  status: ApplicationStatus;
  notes: string;
}

export function ApplicationBoard({ rows, readOnly }: ApplicationBoardProps) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      rows.map((row) => [
        row.job.id,
        { status: row.application.status, notes: row.application.notes ?? '' },
      ]),
    ),
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (rows.length === 0) {
    return (
      <div className="p-8 sm:p-12 text-center rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40">
        <Briefcase className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No applications tracked yet</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
          Open a role and set its status to start tracking it here.
        </p>
      </div>
    );
  }

  const save = (jobId: string) => {
    const draft = drafts[jobId];
    if (!draft) return;

    setFeedback(null);
    startTransition(async () => {
      const statusResult = await setApplicationStatus(jobId, draft.status);
      if (!statusResult.ok) {
        setFeedback(statusResult.message);
        return;
      }

      const notesResult = await updateApplicationNotes(jobId, draft.notes ?? '');
      if (!notesResult.ok) {
        setFeedback(notesResult.message);
        return;
      }

      setFeedback('Saved.');
    });
  };

  return (
    <div className="space-y-3">
      {feedback && (
        <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs font-medium">
          {feedback}
        </div>
      )}

      {rows.map(({ application, job }) => {
        const draft = drafts[job.id] ?? { status: application.status, notes: application.notes ?? '' };

        return (
          <div
            key={application.id}
            className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs flex flex-col lg:flex-row lg:items-center gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{job.title}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${STATUS_TONE[draft.status] ?? STATUS_TONE.archived}`}>
                  {draft.status}
                </span>
                {job.match && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {job.match.match_score}%
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {job.company.name} Â· {job.location ?? 'Remote'} Â· {job.company.ats_type}
                {application.applied_at ? ` Â· applied ${new Date(application.applied_at).toLocaleDateString('en-US')}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={draft.status}
                disabled={readOnly || pending}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [job.id]: { ...draft, status: event.target.value as ApplicationStatus },
                  }))
                }
                className="text-xs py-1.5 px-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border-none text-zinc-700 dark:text-zinc-300 font-medium outline-none cursor-pointer disabled:opacity-50"
              >
                {STATUS_FLOW.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <button
                onClick={() => save(job.id)}
                disabled={readOnly || pending}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </button>

              <a
                href={job.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Job
              </a>
            </div>

            <textarea
              value={draft.notes}
              disabled={readOnly || pending}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [job.id]: { ...draft, notes: event.target.value },
                }))
              }
              placeholder="Notes: recruiter contact, portfolio case study, follow-up date..."
              rows={2}
              className="w-full lg:w-80 shrink-0 text-xs p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-indigo-500 resize-y disabled:opacity-60"
            />
          </div>
        );
      })}
    </div>
  );
}
