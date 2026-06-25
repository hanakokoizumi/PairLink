export type IceFallbackOptions = {
  timeoutMs: number;
  onFailed: () => void;
  onDisconnected?: () => void;
  onRecovered?: () => void;
};

export class IceFallbackMonitor {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disconnectedTimer: ReturnType<typeof setTimeout> | null = null;
  private triggered = false;

  constructor(private options: IceFallbackOptions) {}

  handleState(state: RTCIceConnectionState) {
    if (state === "connected" || state === "completed") {
      this.clearTimers();
      if (this.triggered) {
        this.options.onRecovered?.();
      }
      this.triggered = false;
      return;
    }

    if (state === "disconnected") {
      if (this.disconnectedTimer) clearTimeout(this.disconnectedTimer);
      this.disconnectedTimer = setTimeout(() => {
        this.options.onDisconnected?.();
      }, 5000);
      return;
    }

    if (state === "failed") {
      this.triggerFallback();
      return;
    }

    if (state === "checking" || state === "new") {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.triggerFallback();
      }, this.options.timeoutMs);
    }
  }

  private triggerFallback() {
    if (this.triggered) return;
    this.triggered = true;
    this.clearTimers();
    this.options.onFailed();
  }

  private clearTimers() {
    if (this.timer) clearTimeout(this.timer);
    if (this.disconnectedTimer) clearTimeout(this.disconnectedTimer);
    this.timer = null;
    this.disconnectedTimer = null;
  }

  dispose() {
    this.clearTimers();
  }
}
