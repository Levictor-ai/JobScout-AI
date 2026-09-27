import { getSupabaseServerClient } from '@/lib/supabase/server';
import { readState, writeState } from '@/lib/notifications/live-state';

/**
 * "Have I already sent this?" storage for the live digest.
 *
 * The digest runs from two places with very different storage available:
 *
 * - Locally, a JSON file is durable and free, so that is the default.
 * - On Vercel, the filesystem is read-only and every invocation gets a fresh container, so a
 *   file would silently resend the entire digest on each run. Supabase is the only durable
 *   option already in the stack, so the scheduled route prefers it.
 *
 * `probe()` exists because "Supabase is configured" and "the dedupe table exists" are different
 * claims. Until the migrations are applied the table is missing, and a digest that cannot
 * dedupe is worse than no digest, so the store falls back to the file and says so.
 */

export type DigestSentMap = Record<string, string>;

export interface DigestStore {
  readonly name: 'supabase' | 'file';
  /** Whether this store can actually be used, without committing to a read. */
  probe(): Promise<boolean>;
  read(): Promise<DigestSentMap>;
  write(entries: DigestSentMap): Promise<{ ok: boolean; error?: string }>;
}

const CHANNEL = 'telegram';

function fileStore(): DigestStore {
  return {
    name: 'file',
    probe: async () => true,
    read: async () => (await readState()).sent,
    write: async (entries) => {
      const written = await writeState({ sent: entries });
      return written.ok ? { ok: true } : { ok: false, error: written.error };
    },
  };
}

function supabaseStore(): DigestStore | null {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  return {
    name: 'supabase',
    probe: async () => {
      const { error } = await supabase.from('digest_sent_items').select('item_key').limit(1);
      return !error;
    },
    read: async () => {
      const { data, error } = await supabase
        .from('digest_sent_items')
        .select('item_key, sent_at')
        .eq('channel', CHANNEL);

      // A read failure must not degrade into "send everything again", so this throws and the
      // route reports a failed run instead.
      if (error) throw new Error(error.message);

      const sent: DigestSentMap = {};
      for (const row of data ?? []) {
        if (row && typeof row.item_key === 'string') {
          sent[row.item_key] = new Date(row.sent_at).toISOString();
        }
      }
      return sent;
    },
    write: async (entries) => {
      const rows = Object.entries(entries).map(([itemKey, sentAt]) => ({
        item_key: itemKey,
        channel: CHANNEL,
        sent_at: sentAt,
      }));
      if (rows.length === 0) return { ok: true };

      const { error } = await supabase
        .from('digest_sent_items')
        .upsert(rows, { onConflict: 'item_key', ignoreDuplicates: true });

      return error ? { ok: false, error: error.message } : { ok: true };
    },
  };
}

/** Supabase when it is configured *and* migrated, otherwise the local file. */
export async function resolveDigestStore(): Promise<DigestStore> {
  const supabase = supabaseStore();
  if (supabase && (await supabase.probe())) return supabase;
  return fileStore();
}
