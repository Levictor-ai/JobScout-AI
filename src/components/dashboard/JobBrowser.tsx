'use client';

import React, { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { JobWithDetails } from '@/types';
import { toggleSavedJob } from '@/lib/actions/jobs';
import { JobCard } from './JobCard';
import { JobModal } from './JobModal';
import { Search, Filter, Sparkles, RotateCcw } from 'lucide-react';

interface JobBrowserProps {
  jobs: JobWithDetails[];
  readOnly?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  searchPlaceholder?: string;
  initialRemoteOnly?: boolean;
}

const ROLE_FILTERS = [
  { id: 'all', label: 'All Roles' },
  { id: 'designer', label: 'Product Design' },
  { id: 'design engineer', label: 'Design Engineering' },
  { id: 'ux', label: 'UI/UX' },
  { id: 'brand', label: 'Brand & Systems' },
  { id: 'engineer', label: 'Engineering' },
];

export function JobBrowser({
  jobs,
  readOnly = false,
  emptyTitle = 'No opportunities match the selected criteria',
  emptyBody = 'Try widening the role filter, allowing all locations, or clearing the search box.',
  searchPlaceholder = 'Filter by role, keyword, or company...',
  initialRemoteOnly = false,
}: JobBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [remoteOnly, setRemoteOnly] = useState(initialRemoteOnly);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [items, setItems] = useState<JobWithDetails[]>(jobs);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return items.filter((job) => {
      if (query) {
        const matches =
          job.title.toLowerCase().includes(query) ||
          job.company.name.toLowerCase().includes(query) ||
          job.description.toLowerCase().includes(query);
        if (!matches) return false;
      }

      if (roleFilter !== 'all' && !job.title.toLowerCase().includes(roleFilter)) return false;
      if (remoteOnly && job.remote_status !== 'remote') return false;
      if (sourceFilter !== 'all' && job.company.ats_type !== sourceFilter) return false;

      return true;
    });
  }, [items, searchQuery, roleFilter, remoteOnly, sourceFilter]);

  const selected = items.find((job) => job.id === selectedId) ?? null;

  const handleToggleSave = (jobId: string) => {
    if (readOnly) {
      setNotice('Connect Supabase to save jobs. See Settings for the exact steps.');
      return;
    }

    const previous = items;
    setItems((current) =>
      current.map((job) => (job.id === jobId ? { ...job, is_saved: !job.is_saved } : job)),
    );

    startTransition(async () => {
      const result = await toggleSavedJob(jobId);
      if (!result.ok) {
        setItems(previous);
        setNotice(result.message);
      } else {
        setNotice(result.message);
      }
    });
  };

  const reset = () => {
    setRoleFilter('all');
    setSourceFilter('all');
    setSearchQuery('');
    setRemoteOnly(false);
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5 mr-1">
            <Filter className="w-3.5 h-3.5" />
            Filter:
          </span>

          {ROLE_FILTERS.map((role) => (
            <button
              key={role.id}
              onClick={() => setRoleFilter(role.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                roleFilter === role.id
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 sm:flex-none relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full sm:w-56 pl-8 pr-3 py-1.5 text-xs rounded-lg bg-zinc-100 dark:bg-zinc-800 border-none text-zinc-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border-none text-zinc-700 dark:text-zinc-300 font-medium outline-none cursor-pointer"
          >
            <option value="all">All ATS Sources</option>
            <option value="ashby">Ashby</option>
            <option value="greenhouse">Greenhouse</option>
            <option value="lever">Lever</option>
          </select>

          <button
            onClick={() => setRemoteOnly(!remoteOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              remoteOnly
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-transparent'
            }`}
          >
            {remoteOnly ? 'âœ“ Remote Only' : 'All Locations'}
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs font-medium flex items-center justify-between gap-3">
          <span>{notice}</span>
          <Link href="/settings" className="shrink-0 underline">
            Setup
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span>Opportunities</span>
          <span className="text-xs font-normal text-zinc-400">({filtered.length} results)</span>
        </h2>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40">
          <Sparkles className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{emptyTitle}</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">{emptyBody}</p>
          <button
            onClick={reset}
            className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              readOnly={readOnly}
              busy={pending}
              onSelect={(target) => setSelectedId(target.id)}
              onToggleSave={handleToggleSave}
            />
          ))}
        </div>
      )}

      <JobModal
        job={selected}
        readOnly={readOnly}
        onClose={() => setSelectedId(null)}
        onToggleSave={handleToggleSave}
      />
    </div>
  );
}
