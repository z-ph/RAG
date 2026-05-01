export interface User {
  id: number;
  username: string;
  role: string;
  roleName: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: number;
  code: string;
  name: string;
  description: string;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: number;
  code: string;
  name: string;
  description: string;
  module: string;
  createdAt: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  roleId: number;
}

export interface UpdateUserRequest {
  roleId?: number;
  enabled?: boolean;
}

export interface CreateRoleRequest {
  code: string;
  name: string;
  description?: string;
  permissionIds: number[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissionIds?: number[];
}

export interface ResetPasswordRequest {
  newPassword: string;
}
