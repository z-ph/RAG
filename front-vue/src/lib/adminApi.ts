import type {
  User,
  Role,
  Permission,
  ChangePasswordRequest,
  CreateUserRequest,
  UpdateUserRequest,
  CreateRoleRequest,
  UpdateRoleRequest,
  ResetPasswordRequest
} from "../types/admin";
import { API_BASE_URL, ApiError } from "./api";
import { getAccessToken } from "./tokenStorage";

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `请求失败: HTTP ${response.status}`;
    try {
      const payload = JSON.parse(text) as { message?: string; error?: string };
      message = payload.message || payload.error || message;
    } catch {
      if (text) message = text;
    }
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

// --- Users ---

export function listUsers() {
  return adminRequest<User[]>("/admin/users", { method: "GET" });
}

export function createUser(request: CreateUserRequest) {
  return adminRequest<User>("/admin/users", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export function updateUser(id: number, request: UpdateUserRequest) {
  return adminRequest<User>(`/admin/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(request)
  });
}

export function deleteUser(id: number) {
  return adminRequest<{ message: string }>(`/admin/users/${id}`, { method: "DELETE" });
}

export function resetUserPassword(id: number, request: ResetPasswordRequest) {
  return adminRequest<{ message: string }>(`/admin/users/${id}/reset-password`, {
    method: "POST",
    body: JSON.stringify(request)
  });
}

// --- Roles ---

export function listRoles() {
  return adminRequest<Role[]>("/admin/roles", { method: "GET" });
}

export function createRole(request: CreateRoleRequest) {
  return adminRequest<Role>("/admin/roles", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export function updateRole(id: number, request: UpdateRoleRequest) {
  return adminRequest<Role>(`/admin/roles/${id}`, {
    method: "PUT",
    body: JSON.stringify(request)
  });
}

export function deleteRole(id: number) {
  return adminRequest<{ message: string }>(`/admin/roles/${id}`, { method: "DELETE" });
}

// --- Permissions ---

export function listPermissions() {
  return adminRequest<Permission[]>("/admin/permissions", { method: "GET" });
}

// --- Change Password ---

export function changePassword(request: ChangePasswordRequest) {
  return adminRequest<{ message: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(request)
  });
}
