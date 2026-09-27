import { PipelineRunner } from '@/components/settings/PipelineRunner';
import { getCapabilities, getSetupSteps } from '@/lib/data/capabilities';
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

const ENDPOINTS = [
  { method: 'POST', path: '/api/ingest', purpose: 'Ingest job boards and persist roles.' },
  { method: 'POST', path: '/api/analyze', purpose: 'Classify and match roles. inspectPrompts returns the exact messages without calling OpenAI.' },
  { method: 'POST', path: '/api/notifications/telegram', purpose: 'Send a test message or the high-match digest.' },
];

export default async function SettingsPage() {
  const capabilities = getCapabilities();
  const steps = getSetupSteps(capabilities);

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Run the pipeline and check which credentials this deployment actually has.
        </p>
      </div>

      <PipelineRunner capabilities={capabilities} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Configuration status</h2>
          {steps.map((step) => (
            <div key={step.id} className="flex items-start gap-2.5">
              {step.done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-4 h-4 text-zinc-300 dark:text-zinc-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{step.label}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{step.detail}</p>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 pt-1">
            Model in use: <span className="font-mono">{capabilities.model}</span>. Default monitored boards:{' '}
            {capabilities.defaultCompanyCount}.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">HTTP endpoints</h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            All three are guarded by CRON_SECRET when it is set, and fail closed in production without it.
          </p>
          {ENDPOINTS.map((endpoint) => (
            <div key={endpoint.path} className="flex items-start gap-2.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0 mt-0.5">
                {endpoint.method}
              </span>
              <div>
                <p className="text-xs font-mono text-zinc-800 dark:text-zinc-200">{endpoint.path}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{endpoint.purpose}</p>
              </div>
            </div>
          ))}
          <a
            href="/api/analyze"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Inspect the analysis endpoint
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </>
  );
}
