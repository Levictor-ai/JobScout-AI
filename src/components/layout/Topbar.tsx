'use client';

import React from 'react';
import Link from 'next/link';
import { Send, Database, Sparkles, Radio } from 'lucide-react';

interface TopbarProps {
  dataSource: 'database' | 'demo';
  jobCount: number;
  openaiConfigured: boolean;
  telegramConfigured: boolean;
}

function Pill({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof Send;
  label: string;
  tone: 'emerald' | 'amber' | 'zinc';
}) {
  const tones = {
    emerald: 'border-sky-200 dark:border-sky-900/60 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300',
    amber: 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400',
    zinc: 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400',
  } as const;

  return (
    <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${tones[tone]}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </div>
  );
}

export function Topbar({ dataSource, jobCount, openaiConfigured, telegramConfigured }: TopbarProps) {
  return (
    <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
          <Database className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            {dataSource === 'database' ? `${jobCount} jobs in Supabase` : 'Demo data — Supabase not connected'}
          </span>
        </div>
        <Pill
          icon={Sparkles}
          label={openaiConfigured ? 'AI matching ready' : 'AI matching needs a key'}
          tone={openaiConfigured ? 'emerald' : 'amber'}
        />
        <Pill
          icon={Send}
          label={telegramConfigured ? 'Telegram connected' : 'Telegram off'}
          tone={telegramConfigured ? 'emerald' : 'zinc'}
        />
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 active:scale-95"
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Run Pipeline</span>
        </Link>
      </div>
    </header>
  );
}
