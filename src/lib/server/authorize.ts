import { timingSafeEqual } from 'node:crypto';

export type AuthFailure = { ok: true } | { ok: false; status: number; body: Record<string, string> };

function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Guards scheduled/triggered endpoints with CRON_SECRET.
 * In production a missing CRON_SECRET denies every request instead of opening the route.
 */
export function authorizeRequest(request: Request): AuthFailure {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return {
        ok: false,
        status: 503,
        body: { error: 'CRON_SECRET is not configured on this deployment.' },
      };
    }
    return { ok: true };
  }

  const header = request.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  const provided = bearer || (request.headers.get('x-cron-secret') ?? '').trim();

  if (!provided || !safeEquals(provided, secret)) {
    return { ok: false, status: 401, body: { error: 'Unauthorized' } };
  }

  return { ok: true };
}
