import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { getCapabilities } from '@/lib/data/capabilities';
import { getCompanies, getJobFeed, getProfile, getSavedCount } from '@/lib/data/queries';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const capabilities = getCapabilities();
  const [profile, savedCount, companies, feed] = await Promise.all([
    getProfile(),
    getSavedCount(),
    getCompanies(),
    getJobFeed({ limit: 60 }),
  ]);

  const monitored = companies.companies.filter((company) => company.active).length;
  const engineHealthy = capabilities.persistence;

  return (
    <div className="flex min-h-dvh bg-zinc-50/60 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      <Sidebar
        savedCount={savedCount}
        ownerName={profile.name}
        ownerHeadline={profile.headline}
        engineHealthy={engineHealthy}
        engineLabel={engineHealthy ? 'Scout Engine: Live' : 'Scout Engine: Dry run'}
        engineDetail={
          engineHealthy
            ? `Greenhouse • Ashby • ${monitored} companies`
            : 'Greenhouse • Ashby • nothing persisted'
        }
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          dataSource={feed.source}
          jobCount={feed.totalInDatabase}
          openaiConfigured={capabilities.openai}
          telegramConfigured={capabilities.telegram}
          ownerName={profile.name}
          ownerHeadline={profile.headline}
          savedCount={savedCount}
        />
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6">{children}</main>
      </div>
    </div>
  );
}
