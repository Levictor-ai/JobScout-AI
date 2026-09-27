'use client';

import React from 'react';
import { JobWithDetails } from '@/types';
import {
  ExternalLink,
  Bookmark,
  MapPin,
  Calendar,
  Sparkles,
  DollarSign,
  CircleSlash,
} from 'lucide-react';

interface JobCardProps {
  job: JobWithDetails;
  onSelect: (job: JobWithDetails) => void;
  onToggleSave: (jobId: string) => void;
  readOnly?: boolean;
  busy?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  discovered: 'Discovered',
  saved: 'Saved',
  applying: 'Applying',
  applied: 'Applied',
  assessment: 'Assessment',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  archived: 'Archived',
};

export function JobCard({ job, onSelect, onToggleSave, readOnly = false, busy = false }: JobCardProps) {
  const matchScore = job.match?.match_score ?? 0;
  const status = job.application?.status;

  // Match score visual styling per MATCHING_LOGIC.md
  let badgeColor = 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
  let badgeBorder = 'border-zinc-200 dark:border-zinc-700';
  let matchLabel = 'Standard Match';

  if (matchScore >= 90) {
    badgeColor = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';
    badgeBorder = 'border-emerald-200 dark:border-emerald-800';
    matchLabel = 'Very Strong Alignment';
  } else if (matchScore >= 75) {
    badgeColor = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300';
    badgeBorder = 'border-indigo-200 dark:border-indigo-800';
    matchLabel = 'Strong Alignment';
  } else if (matchScore >= 60) {
    badgeColor = 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';
    badgeBorder = 'border-amber-200 dark:border-amber-800';
    matchLabel = 'Potential Alignment';
  } else if (job.match) {
    matchLabel = 'Low Alignment';
  }

  const timeAgo = job.posted_at
    ? new Date(job.posted_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : 'Recently';

  const salaryText =
    job.salary_min && job.salary_max
      ? `$${(job.salary_min / 1000).toFixed(0)}k - $${(job.salary_max / 1000).toFixed(0)}k`
      : null;

  return (
    <div
      onClick={() => onSelect(job)}
      className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between gap-4 group"
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-700 dark:text-zinc-200 uppercase">
              {job.company.name.slice(0, 2)}
            </div>
            <div>
              <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                {job.company.name}
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                  {job.company.ats_type}
                </span>
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-zinc-400" />
                {job.location || 'Remote'}
              </p>
            </div>
          </div>

          {job.match && (
            <div
              title={matchLabel}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${badgeColor} ${badgeBorder}`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{matchScore}% Match</span>
            </div>
          )}
        </div>

        <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {job.title}
        </h3>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          {job.remote_status === 'remote' && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
              Remote
            </span>
          )}
          {salaryText && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-zinc-400" />
              {salaryText}
            </span>
          )}
          {status && status !== 'discovered' && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40">
              {STATUS_LABELS[status] ?? status}
            </span>
          )}
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {timeAgo}
          </span>
        </div>

        {job.match?.summary ? (
          <div className="mt-3.5 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200/60 dark:border-zinc-800/60">
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2">
              <span className="font-medium text-zinc-900 dark:text-zinc-200">
                {matchLabel} · {job.match.match_score}%
              </span>{' '}
              {job.match.summary}
            </p>
          </div>
        ) : (
          <div className="mt-3.5 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/70 border border-dashed border-zinc-200 dark:border-zinc-800/60">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed flex items-center gap-1.5">
              <CircleSlash className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              Not analysed yet. Run the AI pipeline from Settings to score this role.
            </p>
          </div>
        )}
      </div>

      <div
        className="pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onToggleSave(job.id)}
          disabled={readOnly || busy}
          title={readOnly ? 'Connect Supabase to save jobs' : undefined}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            job.is_saved
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Bookmark className={`w-3.5 h-3.5 ${job.is_saved ? 'fill-amber-500 text-amber-500' : ''}`} />
          <span>{job.is_saved ? 'Saved' : 'Save'}</span>
        </button>

        <a
          href={job.application_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 transition-opacity"
        >
          <span>Apply on {job.company.ats_type}</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
