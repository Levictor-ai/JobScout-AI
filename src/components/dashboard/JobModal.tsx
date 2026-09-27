'use client';

import React, { useState, useTransition } from 'react';
import { ApplicationStatus, JobWithDetails } from '@/types';
import { setApplicationStatus } from '@/lib/actions/jobs';
import {
  X,
  ExternalLink,
  Bookmark,
  Sparkles,
  MapPin,
  CheckCircle,
  AlertCircle,
  DollarSign,
  ShieldAlert,
} from 'lucide-react';

interface JobModalProps {
  job: JobWithDetails | null;
  onClose: () => void;
  onToggleSave: (jobId: string) => void;
  readOnly?: boolean;
}

const STATUS_OPTIONS: Array<{ value: ApplicationStatus; label: string }> = [
  { value: 'saved', label: 'Saved' },
  { value: 'applying', label: 'Applying' },
  { value: 'applied', label: 'Applied' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'archived', label: 'Archived' },
];

export function JobModal({ job, onClose, onToggleSave, readOnly = false }: JobModalProps) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!job) return null;

  const match = job.match;
  const matchScore = match?.match_score ?? 0;

  const handleStatus = (status: ApplicationStatus) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await setApplicationStatus(job.id, status);
      setFeedback(result.message);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-bold text-base text-zinc-800 dark:text-zinc-100 uppercase shrink-0">
              {job.company.name.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {job.company.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                  {job.company.ats_type}
                </span>
              </div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {job.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2.5 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                  {job.location || 'Remote'}
                </span>
                {job.remote_status === 'remote' && (
                  <span className="px-2 py-0.5 rounded-full font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px]">
                    Remote
                  </span>
                )}
                {job.salary_min && job.salary_max && (
                  <span className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-medium">
                    <DollarSign className="w-3.5 h-3.5" />
                    ${(job.salary_min / 1000).toFixed(0)}k - ${(job.salary_max / 1000).toFixed(0)}k {job.salary_currency}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {match && (
            <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/50 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-semibold text-sm">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>AI Match Analysis & Alignment</span>
                </div>
                <div className="px-3 py-1 rounded-full font-bold text-xs bg-indigo-600 text-white shadow-xs">
                  {matchScore}% Score
                </div>
              </div>

              <div className="h-1.5 w-full rounded-full bg-white dark:bg-zinc-900 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600"
                  style={{ width: `${Math.min(100, Math.max(0, matchScore))}%` }}
                />
              </div>

              {match.summary && (
                <p className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed font-normal">
                  {match.summary}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-indigo-100 dark:border-indigo-900/60">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mb-2">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Key Alignment Factors
                  </p>
                  <ul className="space-y-1.5">
                    {match.matching_factors.length > 0 ? (
                      match.matching_factors.map((factor, i) => (
                        <li
                          key={i}
                          className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-tight flex items-start gap-1.5"
                        >
                          <span className="text-emerald-500 font-bold shrink-0">•</span>
                          <span>{factor}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-[11px] text-zinc-400">No factors recorded</li>
                    )}
                  </ul>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-indigo-100 dark:border-indigo-900/60">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Potential Gaps / Focus
                  </p>
                  <ul className="space-y-1.5">
                    {match.skill_gaps.length > 0 ? (
                      match.skill_gaps.map((gap, i) => (
                        <li
                          key={i}
                          className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-tight flex items-start gap-1.5"
                        >
                          <span className="text-amber-500 font-bold shrink-0">•</span>
                          <span>{gap}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-[11px] text-zinc-400">No major gaps identified</li>
                    )}
                  </ul>
                </div>
              </div>

              {match.concerns.length > 0 && (
                <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/60">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-2">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Concerns flagged in the posting
                  </p>
                  <ul className="space-y-1.5">
                    {match.concerns.map((concern, i) => (
                      <li key={i} className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-tight flex items-start gap-1.5">
                        <span className="text-amber-500 font-bold shrink-0">•</span>
                        <span>{concern}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[10px] text-indigo-400 dark:text-indigo-500">
                Scored by {match.model} on {new Date(match.created_at).toLocaleString('en-US')}. Scores are
                AI estimates for a human decision, not a hiring prediction.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Application
            </span>
            <select
              value={job.application?.status ?? 'discovered'}
              disabled={readOnly || pending}
              onChange={(event) => handleStatus(event.target.value as ApplicationStatus)}
              className="text-xs py-1.5 px-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border-none text-zinc-700 dark:text-zinc-300 font-medium outline-none cursor-pointer disabled:opacity-50"
            >
              <option value="discovered">Discovered</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {feedback && <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{feedback}</span>}
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
              Role Description
            </h4>
            <div className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line bg-zinc-50 dark:bg-zinc-950/60 p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 max-h-96 overflow-y-auto">
              {job.description}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 flex items-center justify-between gap-3">
          <button
            onClick={() => onToggleSave(job.id)}
            disabled={readOnly || pending}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              job.is_saved
                ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${job.is_saved ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span>{job.is_saved ? 'Opportunity Saved' : 'Save Opportunity'}</span>
          </button>

          <a
            href={job.application_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
          >
            <span>Proceed to Official Application</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
