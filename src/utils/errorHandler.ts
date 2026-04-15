import type { ToastType } from '../components/Toast';

/**
 * Global toast reference — set by ToastProvider on mount.
 * This allows error handling from non-React contexts (services, stores).
 */
let globalShowToast: ((message: string, type?: ToastType) => void) | null = null;

export function setGlobalToast(fn: ((message: string, type?: ToastType) => void) | null) {
  globalShowToast = fn;
}

/** Log the error and show an error toast. */
export function handleError(error: unknown, context?: string): void {
  const message = error instanceof Error ? error.message : String(error);
  const prefix = context ? `[${context}] ` : '';
  console.error(`${prefix}${message}`);

  if (globalShowToast) {
    const userMessage = context ? `${context}: ${message}` : message;
    globalShowToast(userMessage, 'error');
  }
}

const DEFAULT_RETRY_DELAYS = [1000, 2000, 4000];

/** Exponential backoff; throws lastError after delays.length retries. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { context?: string; delays?: number[] } = {},
): Promise<T> {
  const delays = options.delays ?? DEFAULT_RETRY_DELAYS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < delays.length) {
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }
    }
  }

  if (options.context) {
    handleError(lastError, options.context);
  }
  throw lastError;
}
