import { isAiConfigured, getModel } from '@/lib/ai/client';
import { isTelegramConfigured } from '@/lib/notifications/telegram';
import { isPersistenceAvailable } from '@/lib/ingestion/run-ingestion';
import { DEFAULT_COMPANIES } from '@/lib/ingestion/default-companies';

/**
 * Read-only capability probe. Drives the UI banner and the Settings page so the app never
 * claims a feature is live when its credentials are missing.
 */
export interface AppCapabilities {
  supabase: boolean;
  persistence: boolean;
  openai: boolean;
  model: string;
  telegram: boolean;
  cronSecret: boolean;
  defaultCompanyCount: number;
}

export function getCapabilities(): AppCapabilities {
  return {
    supabase: isPersistenceAvailable(),
    persistence: isPersistenceAvailable(),
    openai: isAiConfigured(),
    model: getModel(),
    telegram: isTelegramConfigured(),
    cronSecret: Boolean(process.env.CRON_SECRET),
    defaultCompanyCount: DEFAULT_COMPANIES.length,
  };
}

export type DataMode = 'database' | 'demo';

export function getDataMode(): DataMode {
  return isPersistenceAvailable() ? 'database' : 'demo';
}

export interface SetupStep {
  id: string;
  label: string;
  detail: string;
  done: boolean;
}

export function getSetupSteps(capabilities: AppCapabilities = getCapabilities()): SetupStep[] {
  return [
    {
      id: 'supabase',
      label: 'Supabase project connected',
      detail: 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then apply the migrations in supabase/migrations.',
      done: capabilities.persistence,
    },
    {
      id: 'openai',
      label: 'OpenAI key configured',
      detail: 'Set OPENAI_API_KEY to enable classification and profile matching.',
      done: capabilities.openai,
    },
    {
      id: 'telegram',
      label: 'Telegram bot connected',
      detail: 'Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to receive high-match digests.',
      done: capabilities.telegram,
    },
    {
      id: 'cron',
      label: 'CRON_SECRET set',
      detail: 'Required in production so scheduled endpoints reject unauthenticated calls.',
      done: capabilities.cronSecret,
    },
  ];
}
