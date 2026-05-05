/**
 * E2E 测试 API 辅助工具
 *
 * 直接调用后端 REST API 来准备/清理测试数据，绕过前端 UI。
 * 使用 JWT Bearer token 认证。
 */

const apiURL = process.env.PLAYWRIGHT_API_URL || "http://localhost:8082";

let accessToken: string | null = null;

export interface ApiAuthUser {
  username: string;
  role: string;
}

export interface ApiAuthStatus {
  authenticated: boolean;
  user?: ApiAuthUser | null;
}

export interface ApiDocument {
  documentId: string;
  filename: string;
  segmentCount: number;
}

export interface ApiRegistrationCode {
  id: number;
  code: string;
  status: string;
}

function authHeaders(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function apiRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${apiURL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${path} failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function getAuthStatus(): Promise<ApiAuthStatus> {
  return apiRequest<ApiAuthStatus>("/auth/me", { method: "GET" });
}

export async function login(
  username: string,
  password: string
): Promise<{ user: ApiAuthUser; message: string; accessToken: string; refreshToken: string }> {
  const result = await apiRequest<{ user: ApiAuthUser; message: string; accessToken: string; refreshToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  accessToken = result.accessToken;
  return result;
}

export async function logout(): Promise<{ message: string }> {
  const result = await apiRequest<{ message: string }>("/auth/logout", { method: "POST" });
  accessToken = null;
  return result;
}

export async function register(
  username: string,
  password: string,
  registrationCode: string
): Promise<{ user: ApiAuthUser; message: string; accessToken: string; refreshToken: string }> {
  const result = await apiRequest<{ user: ApiAuthUser; message: string; accessToken: string; refreshToken: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password, registrationCode }),
  });
  accessToken = result.accessToken;
  return result;
}

export async function listRegistrationCodes(): Promise<{
  codes: ApiRegistrationCode[];
  total: number;
}> {
  return apiRequest("/auth/registration-codes", { method: "GET" });
}

export async function createRegistrationCode(
  note?: string,
  expiresAt?: string | null
): Promise<ApiRegistrationCode> {
  return apiRequest("/auth/registration-codes", {
    method: "POST",
    body: JSON.stringify({ note: note || null, expiresAt: expiresAt || null }),
  });
}

export async function deleteRegistrationCode(id: number): Promise<void> {
  await apiRequest(`/auth/registration-codes/${id}`, { method: "DELETE" });
}

export async function listDocuments(): Promise<{
  documents: ApiDocument[];
  total: number;
}> {
  return apiRequest("/documents", { method: "GET" });
}

export async function listPublicDocuments(): Promise<{
  documents: ApiDocument[];
  total: number;
}> {
  return apiRequest("/documents/public", { method: "GET" });
}

export async function deleteDocument(documentId: string): Promise<void> {
  await apiRequest(`/documents/${documentId}`, { method: "DELETE" });
}

export async function uploadDocument(
  file: Buffer,
  filename: string
): Promise<{ documentId?: string | null; message: string; segmentCount: number }> {
  const formData = new FormData();
  const blob = new Blob([file]);
  formData.append("file", blob, filename);

  const response = await fetch(`${apiURL}/documents/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed: ${response.status} ${text}`);
  }

  return response.json();
}

export async function getRagHealth(): Promise<string> {
  const response = await fetch(`${apiURL}/rag/health`, {
    method: "GET",
  });
  return response.text();
}

export async function getDocumentHealth(): Promise<string> {
  const response = await fetch(`${apiURL}/documents/health`, {
    method: "GET",
  });
  return response.text();
}

/**
 * 等待服务就绪（轮询健康检查）
 */
export async function waitForServices(
  maxAttempts = 60,
  intervalMs = 2000
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const [ragHealth, docHealth] = await Promise.allSettled([
        getRagHealth(),
        getDocumentHealth(),
      ]);
      if (ragHealth.status === "fulfilled" && docHealth.status === "fulfilled") {
        console.log("Services are ready.");
        return;
      }
    } catch {
      // ignore
    }
    console.log(`Waiting for services... (${i + 1}/${maxAttempts})`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Services did not become ready in time");
}
