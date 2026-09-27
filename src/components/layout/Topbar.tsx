'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Send, Database, Sparkles, Radio, Menu, X, LogOut } from 'lucide-react';
import { signOutAction } from '@/app/login/actions';
import { initials, navItems } from './nav-items';

interface TopbarProps {
  dataSource: 'database' | 'demo';
  jobCount: number;
  openaiConfigured: boolean;
  telegramConfigured: boolean;
  ownerName: string;
  ownerHeadline: string | null;
  savedCount: number;
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

export function Topbar({
  dataSource,
  jobCount,
  openaiConfigured,
  telegramConfigured,
  ownerName,
  ownerHeadline,
  savedCount,
}: TopbarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Lock body scroll while the drawer is open, and let Escape dismiss it.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <header className="h-14 sm:h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            className="lg:hidden p-2 -ml-1 rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 min-w-0">
            <Database className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 truncate">
              {dataSource === 'database' ? `${jobCount} jobs` : 'Demo data'}
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

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            href="/settings"
            className="flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-lg text-xs font-semibold transition-all bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 active:scale-95"
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Run Pipeline</span>
          </Link>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={`lg:hidden fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-zinc-900/50 backdrop-blur-sm transition-opacity duration-200 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <aside
          className={`absolute inset-y-0 left-0 w-[17rem] max-w-[85vw] bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-transform duration-200 ease-out ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <span className="font-semibold text-base tracking-tight text-zinc-900 dark:text-zinc-100">
              JobScout
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="p-2 -mr-1 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900/70'
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

          <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
            <div className="p-2.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-700 dark:text-zinc-200 shrink-0">
                {initials(ownerName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{ownerName}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  {ownerHeadline ?? 'Profile not set'}
                </p>
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
      </div>
    </>
  );
}
