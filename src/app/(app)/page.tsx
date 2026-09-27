import { JobBrowser } from '@/components/dashboard/JobBrowser';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { getCapabilities } from '@/lib/data/capabilities';
import { getJobFeed, getProfile } from '@/lib/data/queries';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [feed, profile, capabilities] = await Promise.all([getJobFeed({ limit: 60 }), getProfile(), Promise.resolve(getCapabilities())]);
  const firstName = profile.name.split(' ')[0] || 'there';
  const readOnly = feed.source === 'demo';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {readOnly
              ? 'Showing seed data. Connect Supabase and run the pipeline for live, AI-scored roles.'
              : 'Latest roles from your monitored job boards, ranked by AI match score.'}
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
          <span className={`w-2 h-2 rounded-full ${capabilities.openai ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            {profile.preferences.target_roles.slice(0, 2).join(' • ') || 'No target roles set'}
          </span>
        </div>
      </div>

      <StatsCards stats={feed.stats} />

      <JobBrowser
        jobs={feed.jobs}
        readOnly={readOnly}
        emptyTitle={feed.totalInDatabase === 0 ? 'No jobs stored yet' : 'No opportunities match the selected criteria'}
        emptyBody={
          feed.totalInDatabase === 0
            ? 'Run an ingestion from Settings to pull roles from the monitored Greenhouse and Ashby boards.'
            : 'Try widening the role filter, allowing all locations, or clearing the search box.'
        }
      />
    </>
  );
}
