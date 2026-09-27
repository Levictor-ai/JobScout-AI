import { ApplicationBoard } from '@/components/applications/ApplicationBoard';
import { getCapabilities } from '@/lib/data/capabilities';
import { getApplicationRows } from '@/lib/data/queries';

export const dynamic = 'force-dynamic';

export default async function ApplicationsPage() {
  const [rows, capabilities] = await Promise.all([getApplicationRows(), Promise.resolve(getCapabilities())]);
  const readOnly = !capabilities.persistence;

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Applications</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Track every role you are working through, with notes per application.
        </p>
      </div>

      <ApplicationBoard rows={rows} readOnly={readOnly} />
    </>
  );
}
