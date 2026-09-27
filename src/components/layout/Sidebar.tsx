'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Compass,
  Bookmark,
  Briefcase,
  Building2,
  User,
  Settings,
  Sparkles,
  Bot,
  Radio,
} from 'lucide-react';

interface SidebarProps {
  currentTab?: string;
  onTabChange?: (tab: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { id: 'discover', label: 'Discover', icon: Compass, href: '/discover' },
  { id: 'saved', label: 'Saved Jobs', icon: Bookmark, href: '/saved' },
  { id: 'applications', label: 'Applications', icon: Briefcase, href: '/applications' },
  { id: 'companies', label: 'Companies & ATS', icon: Building2, href: '/companies' },
  { id: 'profile', label: 'Profile & Matching', icon: User, href: '/profile' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
];

export function Sidebar({ currentTab = 'dashboard', onTabChange }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col shrink-0 h-screen sticky top-0 transition-colors">
      {/* Brand Header */}
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

      {/* Live Scout Status Pill */}
      <div className="px-4 pt-4 pb-2">
        <div className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/40 flex items-center gap-2.5">
          <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse shrink-0" />
          <div className="text-[12px] leading-tight overflow-hidden text-ellipsis whitespace-nowrap">
            <span className="font-medium text-emerald-800 dark:text-emerald-300">Scout Engine: Active</span>
            <span className="block text-[10px] text-emerald-600 dark:text-emerald-400">Greenhouse • Lever • Ashby</span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-1 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
          Overview
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            (currentTab && currentTab === item.id) ||
            (!currentTab && (pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))));

          return (
            <button
              key={item.id}
              onClick={() => onTabChange?.(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                isActive
                  ? 'bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900/70'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white dark:text-zinc-900' : 'text-zinc-500 dark:text-zinc-400'}`} />
              <span className="truncate">{item.label}</span>
              {item.id === 'saved' && (
                <span className="ml-auto text-[11px] px-1.5 py-0.2 rounded-full font-mono bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  2
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User / Target Role Footer */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50">
        <div className="p-2.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-700 dark:text-zinc-200 shrink-0">
            AM
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">Alexandre Morgan</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">Product Designer & Design Eng</p>
          </div>
          <Bot className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        </div>
      </div>
    </aside>
  );
}
