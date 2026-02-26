const _firedKeys = new Set<string>();

function isDev(): boolean {
  // webpack / Node / most bundlers (via globalThis to avoid TS errors — no @types/node)
  try {
    const g = globalThis as { process?: { env?: { NODE_ENV?: string } } };
    if (g.process?.env?.NODE_ENV !== undefined) {
      return g.process.env.NODE_ENV !== "production";
    }
  } catch {}

  // Vite / modern bundlers that only set import.meta.env
  try {
    const meta = import.meta as { env?: { DEV?: boolean } };
    if (meta.env?.DEV !== undefined) {
      return !!meta.env.DEV;
    }
  } catch {}

  // Unknown environment — default to showing warnings (safe default for a browser lib)
  return true;
}

export function warnOnce(key: string, message: string): void {
  if (!isDev()) return;
  if (_firedKeys.has(key)) return;
  _firedKeys.add(key);
  console.warn(`[webmcp-react] ${message}`);
}

export function _resetWarnings(): void {
  _firedKeys.clear();
}
