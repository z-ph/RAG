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
import { requestJson } from "./httpClient";

// --- Users ---

export function listUsers() {
  return requestJson<User[]>("/admin/users", {
    method: "GET",
    auth: "required",
    fallbackMessage: "加载用户列表失败"
  });
}

export function createUser(request: CreateUserRequest) {
  return requestJson<User>("/admin/users", {
    method: "POST",
    body: JSON.stringify(request),
    auth: "required",
    fallbackMessage: "创建用户失败"
  });
}

export function updateUser(id: number, request: UpdateUserRequest) {
  return requestJson<User>(`/admin/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(request),
    auth: "required",
    fallbackMessage: "更新用户失败"
  });
}

export function deleteUser(id: number) {
  return requestJson<{ message: string }>(`/admin/users/${id}`, {
    method: "DELETE",
    auth: "required",
    fallbackMessage: "删除用户失败"
  });
}

export function resetUserPassword(id: number, request: ResetPasswordRequest) {
  return requestJson<{ message: string }>(`/admin/users/${id}/reset-password`, {
    method: "POST",
    body: JSON.stringify(request),
    auth: "required",
    fallbackMessage: "重置密码失败"
  });
}

// --- Roles ---

export function listRoles() {
  return requestJson<Role[]>("/admin/roles", {
    method: "GET",
    auth: "required",
    fallbackMessage: "加载角色列表失败"
  });
}

export function createRole(request: CreateRoleRequest) {
  return requestJson<Role>("/admin/roles", {
    method: "POST",
    body: JSON.stringify(request),
    auth: "required",
    fallbackMessage: "创建角色失败"
  });
}

export function updateRole(id: number, request: UpdateRoleRequest) {
  return requestJson<Role>(`/admin/roles/${id}`, {
    method: "PUT",
    body: JSON.stringify(request),
    auth: "required",
    fallbackMessage: "更新角色失败"
  });
}

export function deleteRole(id: number) {
  return requestJson<{ message: string }>(`/admin/roles/${id}`, {
    method: "DELETE",
    auth: "required",
    fallbackMessage: "删除角色失败"
  });
}

// --- Permissions ---

export function listPermissions() {
  return requestJson<Permission[]>("/admin/permissions", {
    method: "GET",
    auth: "required",
    fallbackMessage: "加载权限列表失败"
  });
}

// --- Change Password ---

export function changePassword(request: ChangePasswordRequest) {
  return requestJson<{ message: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(request),
    auth: "required",
    fallbackMessage: "修改密码失败"
  });
}

// --- Logs ---

export interface LogPage {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  size: number;
}

export function queryLogs(params: {
  layer?: string;
  date?: string;
  level?: string;
  keyword?: string;
  timeFrom?: string;
  timeTo?: string;
  sort?: string;
  page?: number;
  size?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.layer) searchParams.set("layer", params.layer);
  if (params.date) searchParams.set("date", params.date);
  if (params.level) searchParams.set("level", params.level);
  if (params.keyword) searchParams.set("keyword", params.keyword);
  if (params.timeFrom) searchParams.set("timeFrom", params.timeFrom);
  if (params.timeTo) searchParams.set("timeTo", params.timeTo);
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.page) searchParams.set("page", String(params.page));
  if (params.size) searchParams.set("size", String(params.size));
  return requestJson<LogPage>(`/admin/logs?${searchParams.toString()}`, {
    method: "GET",
    auth: "required",
    fallbackMessage: "加载日志失败"
  });
}
