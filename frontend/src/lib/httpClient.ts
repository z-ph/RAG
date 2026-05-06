import { setAnonymousAuthSession } from "./authStore";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./tokenStorage";

export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type AuthMode = "none" | "required";
type ContentTypeMode = "none" | "json";

export interface HttpRequestOptions extends RequestInit {
  auth?: AuthMode;
  contentType?: ContentTypeMode;
  fallbackMessage?: string;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

let refreshPromise: Promise<boolean> | null = null;

function clearStoredSession() {
  clearTokens();
  setAnonymousAuthSession({
    authLoading: false,
    authSubmitting: false,
    initialized: true
  });
}

async function parseError(response: Response, fallbackMessage: string) {
  const text = await response.text();

  if (!text) {
    return new ApiError(fallbackMessage, response.status);
  }

  try {
    const payload = JSON.parse(text) as { message?: string; error?: string };
    return new ApiError(payload.message || payload.error || fallbackMessage, response.status);
  } catch {
    return new ApiError(text || fallbackMessage, response.status);
  }
}

function resolveRequestOptions(options?: HttpRequestOptions) {
  return {
    ...options,
    auth: options?.auth ?? "none",
    contentType: options?.contentType ?? "none",
    fallbackMessage: options?.fallbackMessage ?? "请求失败"
  };
}

function buildHeaders(options: ReturnType<typeof resolveRequestOptions>) {
  const headers = new Headers(options.headers);

  if (options.contentType === "json" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth === "required" && !headers.has("Authorization")) {
    const accessToken = getAccessToken();
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  return headers;
}

async function sendRequest(path: string, options: ReturnType<typeof resolveRequestOptions>) {
  const { auth, contentType, fallbackMessage, ...requestInit } = options;

  return fetch(`${API_BASE_URL}${path}`, {
    ...requestInit,
    headers: buildHeaders(options)
  });
}

export async function refreshStoredAccessToken(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      clearStoredSession();
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) {
        clearStoredSession();
        return false;
      }

      const tokens = await response.json() as RefreshResponse;
      setTokens(tokens.accessToken, tokens.refreshToken);
      return true;
    } catch {
      clearStoredSession();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function requestResponse(path: string, options?: HttpRequestOptions) {
  const resolvedOptions = resolveRequestOptions(options);

  if (resolvedOptions.auth === "required" && !getAccessToken() && getRefreshToken()) {
    await refreshStoredAccessToken();
  }

  let response = await sendRequest(path, resolvedOptions);

  if (response.status === 401 && resolvedOptions.auth === "required" && getRefreshToken()) {
    const refreshed = await refreshStoredAccessToken();

    if (refreshed) {
      response = await sendRequest(path, resolvedOptions);
    }
  }

  return response;
}

async function ensureOk(response: Response, fallbackMessage: string) {
  if (response.ok) {
    return;
  }

  throw await parseError(response, fallbackMessage);
}

export async function ensureOkResponse(response: Response, fallbackMessage: string) {
  await ensureOk(response, fallbackMessage);
}

export async function requestJson<T>(path: string, options?: HttpRequestOptions): Promise<T> {
  const resolvedOptions = resolveRequestOptions({
    ...options,
    contentType: options?.contentType ?? "json"
  });
  const response = await requestResponse(path, resolvedOptions);
  await ensureOk(response, `${resolvedOptions.fallbackMessage}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export async function requestText(path: string, options?: HttpRequestOptions) {
  const resolvedOptions = resolveRequestOptions(options);
  const response = await requestResponse(path, resolvedOptions);
  await ensureOk(response, `${resolvedOptions.fallbackMessage}: HTTP ${response.status}`);
  return response.text();
}
