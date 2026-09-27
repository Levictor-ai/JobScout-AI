import { CompanyManager } from '@/components/companies/CompanyManager';
import { getCompanies } from '@/lib/data/queries';

export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
  const { companies, source } = await getCompanies();

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Companies &amp; ATS</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Job boards this deployment reads. Only Greenhouse and Ashby have verified public endpoints here.
        </p>
      </div>

      <CompanyManager companies={companies} dataSource={source} />
    </>
  );
}
