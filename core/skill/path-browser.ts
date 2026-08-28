// Browser-safe path helpers for the extension runtime (Service Worker / background
// and side panel). The extension bundle runs in a browser context where Node
// builtins are NOT available; bundlers stub `node:path` to an empty object, so
// `import { basename } from 'node:path'` yields `undefined` at runtime and throws
// `(0, Vu.basename) is not a function` (see local-skill directory import preview BUG).
//
// These helpers use pure-string operations and are safe in every extension context.
// They intentionally mirror the `node:path` signatures used by callers so the import
// swap is a drop-in replacement.

// Mirrors `node:path.basename(p, suffix?)`:
// returns the last path segment (after normalizing Windows separators), with an
// optional trailing suffix stripped (only when the whole suffix matches at the end).
export function basename(p: string, suffix?: string): string {
  if (!p) return '';
  const normalized = p.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  let name = parts.length ? parts[parts.length - 1] : '';
  if (suffix && suffix.length > 0 && name.endsWith(suffix)) {
    name = name.slice(0, name.length - suffix.length);
  }
  return name;
}
