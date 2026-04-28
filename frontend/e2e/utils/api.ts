/**
 * E2E 测试 API 辅助工具
 *
 * 直接调用后端 REST API 来准备/清理测试数据，绕过前端 UI。
 */

const apiURL = process.env.PLAYWRIGHT_API_URL || "http://localhost:8082";

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

async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  cookies?: string
): Promise<T> {
  const response = await fetch(`${apiURL}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookies ? { Cookie: cookies } : {}),
      ...(init?.headers || {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${path} failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function getAuthStatus(cookies?: string): Promise<ApiAuthStatus> {
  return apiRequest<ApiAuthStatus>("/auth/me", { method: "GET" }, cookies);
}

export async function login(
  username: string,
  password: string
): Promise<{ user: ApiAuthUser } & { message: string }> {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function logout(): Promise<{ message: string }> {
  return apiRequest("/auth/logout", { method: "POST" });
}

export async function register(
  username: string,
  password: string,
  registrationCode: string
): Promise<{ user: ApiAuthUser } & { message: string }> {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password, registrationCode }),
  });
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

  const response = await fetch(`${apiURL}/api/documents/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed: ${response.status} ${text}`);
  }

  return response.json();
}

export async function getRagHealth(): Promise<string> {
  const response = await fetch(`${apiURL}/api/rag/health`, {
    method: "GET",
  });
  return response.text();
}

export async function getDocumentHealth(): Promise<string> {
  const response = await fetch(`${apiURL}/api/documents/health`, {
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
