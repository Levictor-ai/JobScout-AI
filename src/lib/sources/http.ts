import type { AtsType, Json } from '@/types';
import { SourceError } from './types';

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_RETRIES = 2;
const MAX_RESPONSE_BYTES = 8_000_000;

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Honours Retry-After (seconds or HTTP date) so we stay inside source rate limits.
 */
function retryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 30_000);
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.min(Math.max(date - Date.now(), 0), 30_000);
}

export interface FetchJsonOptions {
  atsType: AtsType;
  identifier: string;
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
}

export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions
): Promise<T> {
  const { atsType, identifier, timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES } = options;
  const method = options.method ?? 'GET';

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          accept: 'application/json',
          'user-agent': 'JobScoutAI/0.1 (+personal job discovery; contact via repo owner)',
          ...options.headers,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        if (RETRYABLE_STATUS.has(response.status) && attempt < retries) {
          const wait = retryAfterMs(response.headers.get('retry-after')) ?? 500 * 2 ** attempt;
          await sleep(wait);
          continue;
        }
        throw new SourceError(
          `Request failed with status ${response.status}`,
          { status: response.status, atsType, identifier }
        );
      }

      const body = await readBounded(response, url, atsType, identifier);

      try {
        return JSON.parse(body) as T;
      } catch {
        throw new SourceError('Response was not valid JSON', {
          status: response.status,
          atsType,
          identifier,
        });
      }
    } catch (error) {
      lastError = error;

      if (error instanceof SourceError) throw error;

      const message =
        error instanceof Error
          ? error.name === 'AbortError'
            ? `Request timed out after ${timeoutMs}ms`
            : error.message
          : 'Unknown network error';

      const isLastAttempt = attempt === retries;
      if (!isLastAttempt) {
        await sleep(500 * 2 ** attempt);
        continue;
      }

      throw new SourceError(message, { atsType, identifier });
    } finally {
      clearTimeout(timer);
    }
  }

  throw new SourceError(
    lastError instanceof Error ? lastError.message : 'Request failed',
    { atsType, identifier }
  );
}

async function readBounded(
  response: Response,
  url: string,
  atsType: AtsType,
  identifier: string
): Promise<string> {
  const declared = Number(response.headers.get('content-length') ?? '0');
  if (declared > MAX_RESPONSE_BYTES) {
    throw new SourceError('Response exceeded maximum allowed size', {
      status: response.status,
      atsType,
      identifier,
    });
  }

  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new SourceError(`Response from ${url} exceeded maximum allowed size`, {
      status: response.status,
      atsType,
      identifier,
    });
  }

  return text;
}

export function isJsonObject(value: unknown): value is Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function omitKeys(value: Json, keys: string[]): Json {
  if (!isJsonObject(value)) return value;
  const drop = new Set(keys);
  const result: Record<string, Json> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!drop.has(key)) result[key] = entry;
  }
  return result;
}

export function asString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return null;
}

export function toIsoDate(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value > 1e12 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const text = asString(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
