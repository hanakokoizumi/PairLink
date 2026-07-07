import { normalizeRoomCode } from "@/lib/room-code";

export type ApiError = {
  code: string;
  message?: string;
};

export type PublicSettings = {
  autoAcceptFiles: boolean;
  defaultMaskOnSend: boolean;
  defaultTheme: string;
  defaultLocale: string;
  supportedLocales: string[];
  roomCodeLength: number;
  iceTimeoutSec: number;
  fileMaxSizeBytes: number;
  messageMaxLength: number;
  resumeTransferEnabled: boolean;
};

export type PublicConfig = {
  publicUrl: string;
  disableAuth: boolean;
  oidcEnabled: boolean;
  wsFallback: boolean;
  rtcConfig: RTCConfiguration;
  settings: PublicSettings;
};

export type CreateRoomResponse = {
  roomId: string;
  code: string;
  url: string;
  expiresAt: string;
};

export type LookupRoomResponse = {
  roomId: string;
  expiresAt: string;
};

export type LoginResponse = {
  token: string;
};

export type MeResponse = {
  sub: string;
  username: string;
};

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "";
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & ApiError;
  if (!res.ok) {
    const err = new Error(
      (data as ApiError).code ?? "request_failed",
    ) as Error & { code: string; status: number };
    err.code = (data as ApiError).code ?? "request_failed";
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function fetchConfig(): Promise<PublicConfig> {
  const res = await fetch(`${apiBase()}/api/config`, {
    credentials: "include",
  });
  return parseJson<PublicConfig>(res);
}

export async function createRoom(token?: string): Promise<CreateRoomResponse> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${apiBase()}/api/rooms`, {
    method: "POST",
    headers,
    credentials: "include",
  });
  return parseJson<CreateRoomResponse>(res);
}

export async function lookupRoom(code: string): Promise<LookupRoomResponse> {
  const params = new URLSearchParams({ code: normalizeRoomCode(code) });
  const res = await fetch(`${apiBase()}/api/rooms/lookup?${params}`, {
    credentials: "include",
  });
  return parseJson<LookupRoomResponse>(res);
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const res = await fetch(`${apiBase()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  return parseJson<LoginResponse>(res);
}

export async function fetchMe(token?: string): Promise<MeResponse> {
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${apiBase()}/api/auth/me`, {
    headers,
    credentials: "include",
  });
  return parseJson<MeResponse>(res);
}

export function mapErrorCode(code: string): string {
  const map: Record<string, string> = {
    invalid_credentials: "errors.invalidCredentials",
    oidc_forbidden: "errors.oidcForbidden",
    room_not_found: "errors.roomNotFound",
    room_full: "errors.roomFull",
    room_expired: "errors.roomExpired",
    file_too_large: "errors.fileTooLarge",
    message_too_long: "errors.messageTooLong",
    unauthorized: "errors.unauthorized",
    rate_limited: "errors.rateLimited",
    invalid_code: "errors.invalidCode",
    auth_disabled: "errors.generic",
    invalid_request: "errors.generic",
    lookup_failed: "errors.generic",
    room_create_failed: "errors.generic",
  };
  return map[code] ?? "errors.generic";
}
