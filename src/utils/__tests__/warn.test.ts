import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetWarnings, warnOnce } from "../warn";

// ─── warnOnce ────────────────────────────────────────────────────

describe("warnOnce", () => {
  beforeEach(() => {
    _resetWarnings();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("logs a warning on first call", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnOnce("test-key", "something went wrong");
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith("[webmcp-react] something went wrong");
  });

  it("does not log on subsequent calls with the same key", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnOnce("dup-key", "first");
    warnOnce("dup-key", "second");
    warnOnce("dup-key", "third");
    expect(spy).toHaveBeenCalledOnce();
  });

  it("fires independently for different keys", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnOnce("key-a", "warning A");
    warnOnce("key-b", "warning B");
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith("[webmcp-react] warning A");
    expect(spy).toHaveBeenCalledWith("[webmcp-react] warning B");
  });

  it("does not log when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnOnce("prod-key", "should not appear");
    expect(spy).not.toHaveBeenCalled();
  });

  it("logs again after _resetWarnings() clears state", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnOnce("reset-key", "first time");
    expect(spy).toHaveBeenCalledOnce();

    _resetWarnings();
    warnOnce("reset-key", "second time");
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith("[webmcp-react] second time");
  });
});
