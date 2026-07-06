import { describe, expect, it, vi } from "vitest";
import { IceFallbackMonitor } from "@/lib/webrtc/ice-fallback";

describe("IceFallbackMonitor", () => {
  it("falls back immediately on failed and closed states", () => {
    const onFailedFailed = vi.fn();
    new IceFallbackMonitor({ timeoutMs: 15_000, onFailed: onFailedFailed }).handleState(
      "failed",
    );
    expect(onFailedFailed).toHaveBeenCalledTimes(1);

    const onFailedClosed = vi.fn();
    new IceFallbackMonitor({ timeoutMs: 15_000, onFailed: onFailedClosed }).handleState(
      "closed",
    );
    expect(onFailedClosed).toHaveBeenCalledTimes(1);
  });

  it("waits before falling back on disconnected", () => {
    vi.useFakeTimers();
    const onDisconnected = vi.fn();
    const monitor = new IceFallbackMonitor({
      timeoutMs: 15_000,
      onFailed: vi.fn(),
      onDisconnected,
    });

    monitor.handleState("disconnected");
    expect(onDisconnected).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(onDisconnected).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
