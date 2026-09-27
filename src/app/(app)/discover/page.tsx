import { JobBrowser } from '@/components/dashboard/JobBrowser';
import { getJobFeed } from '@/lib/data/queries';

export const dynamic = 'force-dynamic';

export default async function DiscoverPage() {
  const feed = await getJobFeed({ limit: 120 });
  const readOnly = feed.source === 'demo';

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Discover</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Every role in the database, including the ones AI scoring has not reached yet.
        </p>
      </div>

      <JobBrowser
        jobs={feed.jobs}
        readOnly={readOnly}
        emptyTitle="Nothing to discover yet"
        emptyBody="Run an ingestion from Settings to pull roles from the monitored Greenhouse and Ashby boards."
      />
    </>
  );
}
