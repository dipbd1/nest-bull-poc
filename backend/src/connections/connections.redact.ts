import { APICallError } from 'ai';
import { AiProviderNotConfiguredError, AiRequestError } from '../ai/ai.errors.js';

const SAFE_CODE = /^[A-Z0-9_]{2,32}$/;

export class TimeoutError extends Error {
  constructor() {
    super('Timed out');
    this.name = 'TimeoutError';
  }
}

/** Host, port, and path of a URL. Never the username, password, or query. */
export function publicUrlParts(raw: string): {
  host: string | null;
  port: number | null;
  path: string | null;
} {
  try {
    const url = new URL(raw);
    return {
      host: url.hostname || null,
      port: url.port ? Number(url.port) : null,
      path: url.pathname && url.pathname !== '/' ? url.pathname : null,
    };
  } catch {
    return { host: null, port: null, path: null };
  }
}

export function publicBaseUrl(raw: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return null;
  }
}

/** A driver error code such as ECONNREFUSED, or a generic message. */
export function describeError(error: unknown, fallback: string): string {
  if (error instanceof TimeoutError) return 'Timed out';
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && SAFE_CODE.test(code)) {
    return `${fallback} (${code})`;
  }
  return fallback;
}

/** Provider errors can quote part of the key, so only the status is kept. */
export function describeModelError(error: unknown): string {
  if (error instanceof AiProviderNotConfiguredError) {
    return 'Model provider is not configured';
  }
  const cause = error instanceof AiRequestError ? error.cause : error;
  if (cause instanceof TimeoutError) return 'Timed out';
  if (APICallError.isInstance(cause)) {
    const status = cause.statusCode;
    if (status === 401 || status === 403) {
      return 'Provider rejected the credentials';
    }
    if (status === 404) return 'Provider does not know this model';
    if (status === 429) return 'Provider rate limit reached';
    if (status !== undefined) return `Provider returned HTTP ${status}`;
    return 'Could not reach the provider';
  }
  return 'Model check failed';
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new TimeoutError()), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
