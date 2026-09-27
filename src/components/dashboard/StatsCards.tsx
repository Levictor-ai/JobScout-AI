'use client';

import React from 'react';
import { DashboardStats } from '@/types';
import { Sparkles, Bookmark, Briefcase, Award, TrendingUp } from 'lucide-react';

interface StatsCardsProps {
  stats: DashboardStats;
  onFilterChange?: (filter: string) => void;
}

export function StatsCards({ stats, onFilterChange }: StatsCardsProps) {
  const cards = [
    {
      id: 'new_jobs',
      label: 'New Jobs Found',
      value: stats.newJobsCount,
      subtext: 'Past 48 hours',
      icon: Sparkles,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      border: 'border-indigo-100 dark:border-indigo-900/40',
    },
    {
      id: 'high_matches',
      label: 'High Match (>80%)',
      value: stats.highMatchesCount,
      subtext: 'Recommended priority',
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-100 dark:border-emerald-900/40',
    },
    {
      id: 'saved',
      label: 'Saved Opportunities',
      value: stats.savedJobsCount,
      subtext: 'Ready for review',
      icon: Bookmark,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-100 dark:border-amber-900/40',
    },
    {
      id: 'applied',
      label: 'Active Applications',
      value: stats.activeApplicationsCount,
      subtext: 'In progress',
      icon: Briefcase,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      border: 'border-blue-100 dark:border-blue-900/40',
    },
    {
      id: 'interviews',
      label: 'Interview Pipeline',
      value: stats.interviewsCount,
      subtext: 'Active stage',
      icon: Award,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950/40',
      border: 'border-purple-100 dark:border-purple-900/40',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            onClick={() => onFilterChange?.(card.id)}
            className={`p-4 rounded-xl bg-white dark:bg-zinc-900/80 border ${card.border} shadow-sm hover:shadow-md transition-all cursor-pointer group`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {card.label}
              </span>
              <div className={`p-1.5 rounded-lg ${card.bg} ${card.color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {card.value}
              </span>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
                {card.subtext}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
