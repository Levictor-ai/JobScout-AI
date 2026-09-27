import { JobBrowser } from '@/components/dashboard/JobBrowser';
import { getCapabilities } from '@/lib/data/capabilities';
import { getSavedJobs } from '@/lib/data/queries';

export const dynamic = 'force-dynamic';

export default async function SavedJobsPage() {
  const [jobs, capabilities] = await Promise.all([getSavedJobs(), Promise.resolve(getCapabilities())]);
  const readOnly = !capabilities.persistence;

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Saved Jobs</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Roles you bookmarked, ready for a decision.
        </p>
      </div>

      <JobBrowser
        jobs={jobs}
        readOnly={readOnly}
        emptyTitle="No saved roles yet"
        emptyBody="Use the Save button on any role to keep it here."
      />
    </>
  );
}
