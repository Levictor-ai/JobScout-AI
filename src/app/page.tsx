'use client';

import React, { useState, useMemo } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { JobCard } from '@/components/dashboard/JobCard';
import { JobModal } from '@/components/dashboard/JobModal';
import { sampleJobs, sampleDashboardStats } from '@/data/seed-data';
import { JobWithDetails } from '@/types';
import {
  Sparkles,
  Building2,
  RefreshCw,
  ChevronRight,
  Filter,
} from 'lucide-react';

export default function DashboardPage() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState<JobWithDetails | null>(null);
  const [jobs, setJobs] = useState<JobWithDetails[]>(sampleJobs);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [remoteOnlyFilter, setRemoteOnlyFilter] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('all');

  // Dynamic greeting based on current hour
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Save / Unsave handler
  const handleToggleSave = (jobId: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, is_saved: !j.is_saved } : j))
    );
    if (selectedJob && selectedJob.id === jobId) {
      setSelectedJob((prev) => (prev ? { ...prev, is_saved: !prev.is_saved } : null));
    }
  };

  // Trigger ATS Scan Simulation
  const handleScanNow = () => {
    setIsScanning(true);
    setScanMessage('Scanning Greenhouse, Lever, and Ashby endpoints for 5 companies...');

    setTimeout(() => {
      setIsScanning(false);
      setScanMessage('Scan complete: 5 monitored companies active. 14 positions verified.');
      setTimeout(() => setScanMessage(null), 5000);
    }, 1800);
  };

  // Filtered jobs calculation
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Tab filter
      if (currentTab === 'saved' && !job.is_saved) return false;
      if (currentTab === 'applications' && !job.application) return false;

      // Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = job.title.toLowerCase().includes(query);
        const matchesCompany = job.company.name.toLowerCase().includes(query);
        const matchesDesc = job.description.toLowerCase().includes(query);
        if (!matchesTitle && !matchesCompany && !matchesDesc) return false;
      }

      // Role filter
      if (roleFilter !== 'all') {
        if (!job.title.toLowerCase().includes(roleFilter.toLowerCase())) {
          return false;
        }
      }

      // Remote filter
      if (remoteOnlyFilter && job.remote_status !== 'remote') {
        return false;
      }

      // Source filter
      if (sourceFilter !== 'all' && job.company.ats_type !== sourceFilter) {
        return false;
      }

      return true;
    });
  }, [jobs, searchQuery, roleFilter, remoteOnlyFilter, sourceFilter, currentTab]);

  return (
    <div className="flex min-h-screen bg-zinc-50/60 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onScanNow={handleScanNow}
          isScanning={isScanning}
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Scan feedback toast */}
          {scanMessage && (
            <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs font-medium flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 text-indigo-600 dark:text-indigo-400 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{scanMessage}</span>
              </div>
            </div>
          )}

          {/* Contextual Greeting Header per UI_SPEC.md */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {greeting}, Alexandre
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                Here are the latest opportunities matching your profile.
              </p>
            </div>

            {/* Profile match indicator badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Target: Product Design & Systems
              </span>
            </div>
          </div>

          {/* Stats Overview */}
          <StatsCards
            stats={sampleDashboardStats}
            onFilterChange={(filter) => {
              if (filter === 'saved') setCurrentTab('saved');
              if (filter === 'applied') setCurrentTab('applications');
              if (filter === 'high_matches') setRoleFilter('all');
            }}
          />

          {/* Filter Toolbar */}
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5 mr-1">
                <Filter className="w-3.5 h-3.5" />
                Filter:
              </span>

              {/* Role filter buttons */}
              {[
                { id: 'all', label: 'All Roles' },
                { id: 'Product Designer', label: 'Product Design' },
                { id: 'Design Engineer', label: 'Design Engineering' },
                { id: 'UI/UX', label: 'UI/UX' },
                { id: 'Brand', label: 'Brand & Systems' },
              ].map((role) => (
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
              {/* ATS Selector */}
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="text-xs py-1.5 px-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border-none text-zinc-700 dark:text-zinc-300 font-medium outline-none cursor-pointer"
              >
                <option value="all">All ATS Sources</option>
                <option value="ashby">Ashby</option>
                <option value="greenhouse">Greenhouse</option>
                <option value="lever">Lever</option>
              </select>

              {/* Remote only toggle */}
              <button
                onClick={() => setRemoteOnlyFilter(!remoteOnlyFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  remoteOnlyFilter
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-transparent'
                }`}
              >
                {remoteOnlyFilter ? '✓ Remote Worldwide' : 'All Locations'}
              </button>
            </div>
          </div>

          {/* Job Listings Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>
                  {currentTab === 'saved'
                    ? 'Saved Opportunities'
                    : currentTab === 'applications'
                    ? 'Active Application Pipeline'
                    : 'Top AI-Matched Opportunities'}
                </span>
                <span className="text-xs font-normal text-zinc-400">
                  ({filteredJobs.length} results)
                </span>
              </h2>

              {currentTab !== 'dashboard' && (
                <button
                  onClick={() => setCurrentTab('dashboard')}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  Back to All Recommendations
                </button>
              )}
            </div>

            {filteredJobs.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40">
                <Sparkles className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  No opportunities match the selected criteria
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                  Try adjusting the role filter, location options, or ATS source to expand your discovery results.
                </p>
                <button
                  onClick={() => {
                    setRoleFilter('all');
                    setSourceFilter('all');
                    setSearchQuery('');
                  }}
                  className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onSelect={setSelectedJob}
                    onToggleSave={handleToggleSave}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Monitored Companies Quick Preview Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-zinc-900 to-zinc-950 text-white border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                  Configured ATS Monitor
                </span>
              </div>
              <p className="text-sm font-medium text-zinc-200">
                Currently tracking 5 premier companies via official public ATS APIs: Linear, Vercel, Figma, Supabase, and Stripe.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right hidden sm:block">
                <span className="text-xs font-semibold text-emerald-400 block">All APIs Healthy</span>
                <span className="text-[11px] text-zinc-400">Greenhouse • Lever • Ashby</span>
              </div>
              <button
                onClick={handleScanNow}
                className="px-3.5 py-2 rounded-xl bg-white text-zinc-900 hover:bg-zinc-100 text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <span>Trigger Ingestion</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Detailed Match & Requirements Modal */}
      <JobModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onToggleSave={handleToggleSave}
      />
    </div>
  );
}
