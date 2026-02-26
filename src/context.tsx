import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cleanupPolyfill, installPolyfill } from "./polyfill";
import type { WebMCPProviderProps, WebMCPStatus } from "./types";
import { warnOnce } from "./utils/warn";

// ─── Context ──────────────────────────────────────────────────────

interface WebMCPContextValue {
  available: boolean;
  name: string;
  version: string;
}

const MISSING_PROVIDER: WebMCPContextValue = {
  available: false,
  name: "",
  version: "",
};

const WebMCPContext = createContext<WebMCPContextValue>(MISSING_PROVIDER);

// ─── Polyfill refcount ────────────────────────────────────────────

let polyfillConsumerCount = 0;

/** @internal — test-only reset */
function _resetPolyfillConsumerCount(): void {
  polyfillConsumerCount = 0;
}

// ─── Provider ─────────────────────────────────────────────────────

function WebMCPProvider({ name, version, children }: WebMCPProviderProps) {
  const [available, setAvailable] = useState(false);
  const usesPolyfillRef = useRef(false);

  useEffect(() => {
    const hasNativeApi =
      !!navigator.modelContext && !("__isWebMCPPolyfill" in navigator.modelContext);

    if (!hasNativeApi) {
      installPolyfill();
      usesPolyfillRef.current = true;
      polyfillConsumerCount++;
    }

    setAvailable(!!navigator.modelContext);

    return () => {
      if (usesPolyfillRef.current) {
        polyfillConsumerCount--;
        usesPolyfillRef.current = false;
        if (polyfillConsumerCount === 0) {
          cleanupPolyfill();
        }
      }
    };
  }, []);

  const value = useMemo(() => ({ available, name, version }), [available, name, version]);

  return <WebMCPContext.Provider value={value}>{children}</WebMCPContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────

function useWebMCPStatus(): WebMCPStatus {
  const ctx = useContext(WebMCPContext);
  if (ctx === MISSING_PROVIDER) {
    warnOnce(
      "missing-provider",
      "useWebMCPStatus must be used inside <WebMCPProvider>. Returning { available: false }.",
    );
  }
  return { available: ctx.available };
}

// ─── Exports ──────────────────────────────────────────────────────

export {
  WebMCPProvider,
  useWebMCPStatus,
  WebMCPContext,
  MISSING_PROVIDER,
  _resetPolyfillConsumerCount,
};
