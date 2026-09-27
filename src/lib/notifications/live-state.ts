import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * "Have I already sent this?" state for the database-free live digest.
 *
 * `notification_log` is the right home for this, but the live digest is explicitly the path
 * that works without Supabase, so it keeps its own small JSON file. A local file is durable
 * on a laptop and useless on serverless, so `readState`/`writeState` treat missing or
 * unreadable state as "send nothing already sent" rather than failing the digest.
 */

export interface DigestState {
  sent: Record<string, string>;
}

const EMPTY: DigestState = { sent: {} };

function statePath(): string {
  return process.env.DIGEST_STATE_FILE?.trim() || path.join(process.cwd(), '.local', 'digest-state.json');
}

export async function readState(): Promise<DigestState> {
  const file = statePath();
  if (!existsSync(file)) return { ...EMPTY, sent: {} };

  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as Partial<DigestState>;
    return { sent: typeof parsed.sent === 'object' && parsed.sent !== null ? parsed.sent : {} };
  } catch {
    return { ...EMPTY, sent: {} };
  }
}

export async function writeState(state: DigestState): Promise<{ ok: boolean; file: string; error?: string }> {
  const file = statePath();

  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    return { ok: true, file };
  } catch (error) {
    // A read-only deployment still gets its digest; it just may repeat itself next run.
    return {
      ok: false,
      file,
      error: error instanceof Error ? error.message : 'Could not write digest state.',
    };
  }
}

/** Stable per-posting key, so the same role from two boards counts once. */
export function jobKey(parts: { company: string; title: string; url: string }): string {
  const basis = `${parts.company}|${parts.title}|${parts.url}`.toLowerCase().replace(/[^a-z0-9|]+/g, '');
  return basis.slice(0, 120);
}
