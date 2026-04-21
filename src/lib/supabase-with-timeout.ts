/**
 * Helpers to run a Supabase call (or any promise) with a hard timeout.
 *
 * Prevents UI from hanging forever on dead connections. The Supabase JS client
 * does not natively support AbortSignal on every method, so we race the
 * underlying promise against a timer.
 */

export class TimeoutError extends Error {
  constructor(public readonly ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: PromiseLike<T>, ms = 8000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export function isTimeoutError(err: unknown): err is TimeoutError {
  return err instanceof TimeoutError;
}
