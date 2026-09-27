'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Radio, LogOut } from 'lucide-react';
import { signOutAction } from '@/app/login/actions';
import { initials, navItems } from './nav-items';

interface SidebarProps {
  savedCount: number;
  ownerName: string;
  ownerHeadline: string | null;
  engineLabel: string;
  engineDetail: string;
  engineHealthy: boolean;
}

export function Sidebar({
  savedCount,
  ownerName,
  ownerHeadline,
  engineLabel,
  engineDetail,
  engineHealthy,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 shrink-0 h-screen sticky top-0 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 transition-colors">
      <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-indigo-100" />
          </div>
          <div>
            <span className="font-semibold text-base tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              JobScout <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300">AI</span>
            </span>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Autonomous Job Discovery</p>
          </div>
        </Link>
      </div>

      <div className="px-4 pt-4 pb-2">
        <div
          className={`px-3 py-2 rounded-lg border flex items-center gap-2.5 ${
            engineHealthy
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/70 dark:border-emerald-800/40'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/70 dark:border-amber-800/40'
          }`}
        >
          <Radio className={`w-3.5 h-3.5 shrink-0 ${engineHealthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
          <div className="text-[12px] leading-tight overflow-hidden text-ellipsis whitespace-nowrap">
            <span className={`font-medium ${engineHealthy ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
              {engineLabel}
            </span>
            <span className={`block text-[10px] ${engineHealthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {engineDetail}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-1 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
          Overview
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900/70'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${isActive ? 'text-white dark:text-zinc-900' : 'text-zinc-500 dark:text-zinc-400'}`}
              />
              <span className="truncate">{item.label}</span>
              {item.id === 'saved' && savedCount > 0 && (
                <span className="ml-auto text-[11px] px-1.5 py-0.2 rounded-full font-mono bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {savedCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50">
        <div className="p-2.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-700 dark:text-zinc-200 shrink-0">
            {initials(ownerName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{ownerName}</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{ownerHeadline ?? 'Profile not set'}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              title="Sign out"
              aria-label="Sign out"
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
