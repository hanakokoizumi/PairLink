export type WsEnvelope<T = unknown> = {
  type: string;
  payload?: T;
};

export type WsConfigPayload = {
  peerId: string;
  roomId: string;
  role: "host" | "guest";
  wsFallback: boolean;
  maxMessageBytes: number;
};

export type SignalPayload = {
  to?: string;
  from?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type Handler = (payload: unknown) => void;

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];
const DEV_API_PORT = "8080";

function wsUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (base) {
    const url = new URL(base);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws";
    return url.toString();
  }
  if (typeof window !== "undefined") {
    const wsProto =
      window.location.protocol === "https:" ? "wss:" : "ws:";
    const { hostname, port } = window.location;
    // make dev: Next.js rewrites cannot upgrade WebSocket; connect to Go API directly.
    if (
      process.env.NODE_ENV === "development" &&
      port !== "" &&
      port !== DEV_API_PORT
    ) {
      return `${wsProto}//${hostname}:${DEV_API_PORT}/ws`;
    }
    const hostPort = port ? `${hostname}:${port}` : hostname;
    return `${wsProto}//${hostPort}/ws`;
  }
  return `ws://localhost:${DEV_API_PORT}/ws`;
}

export class SignalingClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private reconnectAttempt = 0;
  private shouldReconnect = true;
  private joinPayload: WsEnvelope | null = null;
  private token?: string;
  private connectGeneration = 0;

  constructor(token?: string) {
    this.token = token;
  }

  connect(): Promise<void> {
    const generation = ++this.connectGeneration;
    return new Promise((resolve, reject) => {
      this.shouldReconnect = true;
      const socket = new WebSocket(wsUrl());
      this.ws = socket;

      const stale = () => generation !== this.connectGeneration;

      socket.onopen = () => {
        if (stale()) return;
        this.reconnectAttempt = 0;
        if (this.token) {
          this.sendRaw({ type: "auth", payload: { token: this.token } });
        }
        if (this.joinPayload) {
          this.sendRaw(this.joinPayload);
        }
        this.dispatch("ws-open", undefined);
        resolve();
      };

      socket.onmessage = (event) => {
        try {
          const env = JSON.parse(event.data as string) as WsEnvelope;
          if (env.type === "ping") {
            this.sendRaw({ type: "pong" });
            return;
          }
          if (env.type === "error") {
            const code =
              env.payload &&
              typeof env.payload === "object" &&
              "code" in env.payload
                ? String((env.payload as { code: string }).code)
                : "";
            if (code === "rate_limited") {
              this.shouldReconnect = false;
            }
          }
          this.dispatch(env.type, env.payload);
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        if (stale()) return;
        this.dispatch("ws-close", undefined);
        if (this.shouldReconnect && this.reconnectAttempt < RECONNECT_DELAYS.length) {
          const delay = RECONNECT_DELAYS[this.reconnectAttempt]!;
          this.reconnectAttempt++;
          setTimeout(() => {
            void this.connect();
          }, delay);
        }
      };

      socket.onerror = () => {
        if (stale()) return;
        if (socket.readyState !== WebSocket.OPEN) {
          reject(new Error("ws_connect_failed"));
        }
      };
    });
  }

  disconnect() {
    this.connectGeneration++;
    this.shouldReconnect = false;
    this.ws?.close();
    this.ws = null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  on(type: string, handler: Handler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  private dispatch(type: string, payload: unknown) {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const handler of set) handler(payload);
  }

  send(type: string, payload?: unknown) {
    this.sendRaw({ type, payload });
  }

  private sendRaw(env: WsEnvelope) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(env));
  }

  hostJoin(roomId: string, token?: string) {
    this.joinPayload = {
      type: "host-join",
      payload: { roomId, token },
    };
    this.sendRaw(this.joinPayload);
  }

  joinRoom(params: { roomId?: string; code?: string }) {
    this.joinPayload = { type: "join-room", payload: params };
    this.sendRaw(this.joinPayload);
  }

  signal(payload: SignalPayload) {
    this.send("signal", payload);
  }

  e2eHandshake(to: string, publicKey: string) {
    this.send("e2e-handshake", { to, publicKey });
  }

  relayChunk(payload: {
    transferId: string;
    seq: number;
    ciphertext: string;
    iv: string;
    to?: string;
  }) {
    this.send("relay-chunk", payload);
  }
}
