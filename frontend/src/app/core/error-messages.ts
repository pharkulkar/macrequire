import { HttpErrorResponse } from '@angular/common/http';

/**
 * Turns a failed request into a sentence a visitor can act on. Developer details (status codes, "the API is running")
 * never reach the screen: a person needs to know whether to check their connection, wait a moment, or try something else.
 */
export type ErrorKind = 'offline' | 'unreachable' | 'timeout' | 'rate-limited' | 'not-found' | 'invalid' | 'server' | 'unknown';

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export function classifyError(e: unknown): ErrorKind {
  if (!(e instanceof HttpErrorResponse)) return 'unknown';
  const s = e.status;
  if (s === 0) return isOffline() ? 'offline' : 'unreachable'; // the request never got an answer
  if (s === 408 || s === 504) return 'timeout';
  if (s === 429) return 'rate-limited';
  if (s === 404) return 'not-found';
  if (s === 400 || s === 422) return 'invalid';
  if (s >= 500) return 'server';
  return 'unknown';
}

const REASON: Record<ErrorKind, string> = {
  offline: "You're offline. Check your internet connection and try again.",
  unreachable: "We can't reach MacRequire right now. Check your connection, or try again in a moment.",
  timeout: 'That took too long. Please try again.',
  'rate-limited': 'Too many requests in a short time. Please wait a minute and try again.',
  'not-found': "We couldn't find what you were looking for.",
  invalid: "Some details weren't accepted. Please review them and try again.",
  server: 'Something went wrong on our side. Please try again in a few minutes.',
  unknown: 'Something went wrong. Please try again.',
};

/** The reason on its own, for example "You're offline. Check your internet connection and try again." */
export function errorReason(e: unknown): string {
  return REASON[classifyError(e)];
}

/**
 * A full message for a failed action, such as failureMessage(e, 'load the catalog').
 * When the cause is the visitor's connection or request rate, the reason says everything, so it stands alone.
 */
export function failureMessage(e: unknown, doing: string): string {
  const kind = classifyError(e);
  if (kind === 'offline' || kind === 'unreachable' || kind === 'rate-limited') return REASON[kind];
  return `We couldn't ${doing}. ${REASON[kind]}`;
}
