import { logger } from "./logger";

export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  timeoutMs?: number;
  label?: string;
}

/**
 * Throw this from inside `withRetry`'s callback to fail immediately without
 * burning the remaining attempts — for errors a retry can never fix, such as
 * an invalid/missing API key (401/403). The message is preserved as-is.
 */
export class NoRetryError extends Error {}

/** Runs `fn` with retries, exponential backoff, and a per-attempt timeout. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { attempts = 3, delayMs = 500, timeoutMs = 8000, label = "operation" } = opts;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await withTimeout(fn(), timeoutMs, label);
    } catch (err) {
      lastError = err;
      logger.warn(`${label} failed on attempt ${attempt}/${attempts}`, {
        error: err instanceof Error ? err.message : String(err),
      });
      if (err instanceof NoRetryError) break;
      if (attempt < attempts) {
        await sleep(delayMs * attempt);
      }
    }
  }
  throw lastError;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
