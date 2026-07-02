/**
 * Shared helpers for the L4 optimistic-update / rollback hook tests
 * (docs/design-research/recon/test-audit.md §L4, #21).
 *
 * The data hooks apply an optimistic cache write in `onMutate`, then either
 * commit (`onSuccess`) or roll back to the pre-mutation snapshot (`onError`).
 * To observe the mid-flight optimistic state deterministically — instead of
 * racing a real timer — each test installs an MSW handler that awaits a
 * `deferred()` gate before responding. The test:
 *   1. fires the mutation,
 *   2. `waitFor`s the optimistic cache write (the gate holds the request open),
 *   3. opens the gate for success or failure,
 *   4. `waitFor`s the commit or the rollback.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { HttpResponse } from 'msw';

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

/** A promise whose settlement the test controls. */
export function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A QueryClient with retries off so a single 4xx/5xx surfaces immediately. */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

/** Wrapper + its QueryClient (so tests can inspect the raw cache directly). */
export function makeWrapper() {
  const queryClient = makeQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, queryClient };
}

/** Success envelope the api clients expect: { success: true, data }. */
export const ok = (data: unknown) => HttpResponse.json({ success: true, data });

/**
 * Failure envelope with a real status. Stays `application/json` so the api
 * clients take the error branch (a non-JSON body makes them fall back to
 * localStorage instead of rejecting).
 */
export const fail = (message: string, status = 500) =>
  HttpResponse.json({ success: false, error: { message } }, { status });
