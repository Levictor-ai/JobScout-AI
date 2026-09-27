'use client';

import React from 'react';
import { Search, RefreshCw, Send } from 'lucide-react';

interface HeaderProps {
  onScanNow?: () => void;
  isScanning?: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function Header({
  onScanNow,
  isScanning = false,
  searchQuery,
  onSearchChange,
}: HeaderProps) {
  return (
    <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* Search Bar */}
      <div className="flex-1 max-w-md relative">
        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter opportunities by role, keyword, or company..."
          className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-zinc-100/80 dark:bg-zinc-900 border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none transition-all"
        />
      </div>

      {/* Actions and Status */}
      <div className="flex items-center gap-3">
        {/* Telegram Bot Notification Status */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-sky-200 dark:border-sky-900/60 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-xs font-medium">
          <Send className="w-3.5 h-3.5 text-sky-500" />
          <span>Telegram Alerts On</span>
        </div>

        {/* Scan Now Button */}
        <button
          onClick={onScanNow}
          disabled={isScanning}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all ${
            isScanning
              ? 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 active:scale-95'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Scanning ATS Sources...' : 'Trigger ATS Scan'}</span>
        </button>
      </div>
    </header>
  );
}
