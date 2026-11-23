import { Observe, useObserve } from 'expo-observe';
import { useEffect } from 'react';

// the one door from app code to expo observe. the root layout owns
// Observe.configure and ObserveRoot; everything else goes through here so
// that what leaves the device is decided in one place.

// the areas whose recovered failures are worth seeing in the dashboard
export type DiagnosticArea =
  | 'persistence'
  | 'sync'
  | 'widgets'
  | 'notifications'
  | 'import'
  | 'export'
  | 'rewards'
  | 'check-ins';

// record ids and email addresses never leave the device inside a message
const REDACTIONS: readonly (readonly [RegExp, string])[] = [
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>'],
  [/[^\s@<>()"'`]+@[^\s@<>()"'`]+\.[a-z]{2,}/gi, '<email>'],
];

export function redactDiagnostic(text: string): string {
  return REDACTIONS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);
}

function errorHeader(error: Error): string {
  return error.message ? `${error.name}: ${error.message}` : error.name;
}

// reports a failure the app caught and recovered from. pass the thrown value,
// or an error built from a domain error code; never a domain message, which
// can carry user text such as board titles or notes.
export function reportHandledError(area: DiagnosticArea, cause: unknown): void {
  const source = cause instanceof Error ? cause : null;
  const error = new Error(`${area}: ${redactDiagnostic(source ? source.message : String(cause))}`);
  if (source) {
    error.name = source.name;
    // the stack repeats the raw message in its first line; swap that header
    // and keep the frames, which carry only function names and bundle offsets
    const original = errorHeader(source);
    if (typeof source.stack === 'string' && source.stack.startsWith(original)) {
      error.stack = `${errorHeader(error)}${source.stack.slice(original.length)}`;
    }
  }
  Observe.reportError(error);
}

// marks the current route interactive once its first content can be used.
// only the first call per navigation is recorded, so a ready flag that
// flips back and forth is harmless.
export function useMarkInteractive(ready: boolean): void {
  const { markInteractive } = useObserve();
  useEffect(() => {
    if (ready) markInteractive();
  }, [ready, markInteractive]);
}
