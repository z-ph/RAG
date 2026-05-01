import { ref } from "vue";
import type {
  User,
  Role,
  Permission,
  CreateUserRequest,
  UpdateUserRequest,
  CreateRoleRequest,
  UpdateRoleRequest,
  ResetPasswordRequest,
  ChangePasswordRequest
} from "../types/admin";
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  listPermissions,
  changePassword
} from "../lib/adminApi";
import {
  adminListSegments,
  adminUpdateSegment,
  adminDeleteSegment,
  adminReindexDocument,
  listPrompts,
  updatePrompt,
  resetPrompt
} from "../lib/api";
import type {
  AdminSegmentInfo,
  AdminSegmentListResponse,
  PromptInfo
} from "../lib/api";
import { ApiError } from "../lib/api";

interface MessageApi {
  error: (content: string) => void;
  success: (content: string) => void;
}

export function useAdminState(messageApi: MessageApi) {
  // Users
  const users = ref<User[]>([]);
  const usersLoading = ref(false);

  // Roles
  const roles = ref<Role[]>([]);
  const rolesLoading = ref(false);

  // Permissions
  const permissions = ref<Permission[]>([]);
  const permissionsLoading = ref(false);

  // Prompts
  const prompts = ref<PromptInfo[]>([]);
  const promptsLoading = ref(false);

  // Document Segments
  const segments = ref<AdminSegmentInfo[]>([]);
  const segmentsLoading = ref(false);
  const segmentsTotal = ref(0);
  const segmentsDocumentId = ref<string>("");

  // Actions
  async function refreshUsers() {
    usersLoading.value = true;
    try {
      users.value = await listUsers();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载用户失败");
    } finally {
      usersLoading.value = false;
    }
  }

  async function handleCreateUser(request: CreateUserRequest) {
    try {
      await createUser(request);
      messageApi.success("用户创建成功");
      await refreshUsers();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "创建用户失败");
    }
  }

  async function handleUpdateUser(id: number, request: UpdateUserRequest) {
    try {
      await updateUser(id, request);
      messageApi.success("用户更新成功");
      await refreshUsers();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "更新用户失败");
    }
  }

  async function handleDeleteUser(id: number) {
    try {
      await deleteUser(id);
      messageApi.success("用户删除成功");
      await refreshUsers();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "删除用户失败");
    }
  }

  async function handleResetUserPassword(id: number, request: ResetPasswordRequest) {
    try {
      await resetUserPassword(id, request);
      messageApi.success("密码重置成功");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "重置密码失败");
    }
  }

  async function refreshRoles() {
    rolesLoading.value = true;
    try {
      roles.value = await listRoles();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载角色失败");
    } finally {
      rolesLoading.value = false;
    }
  }

  async function handleCreateRole(request: CreateRoleRequest) {
    try {
      await createRole(request);
      messageApi.success("角色创建成功");
      await refreshRoles();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "创建角色失败");
    }
  }

  async function handleUpdateRole(id: number, request: UpdateRoleRequest) {
    try {
      await updateRole(id, request);
      messageApi.success("角色更新成功");
      await refreshRoles();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "更新角色失败");
    }
  }

  async function handleDeleteRole(id: number) {
    try {
      await deleteRole(id);
      messageApi.success("角色删除成功");
      await refreshRoles();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "删除角色失败");
    }
  }

  async function refreshPermissions() {
    permissionsLoading.value = true;
    try {
      permissions.value = await listPermissions();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载权限失败");
    } finally {
      permissionsLoading.value = false;
    }
  }

  async function handleChangePassword(request: ChangePasswordRequest) {
    try {
      await changePassword(request);
      messageApi.success("密码修改成功");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "修改密码失败");
    }
  }

  async function refreshPrompts() {
    promptsLoading.value = true;
    try {
      prompts.value = await listPrompts();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载提示词失败");
    } finally {
      promptsLoading.value = false;
    }
  }

  async function handleUpdatePrompt(key: string, content: string, description?: string) {
    try {
      await updatePrompt(key, content, description);
      messageApi.success("提示词更新成功");
      await refreshPrompts();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "更新提示词失败");
    }
  }

  async function handleResetPrompt(key: string) {
    try {
      await resetPrompt(key);
      messageApi.success("提示词已重置");
      await refreshPrompts();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "重置提示词失败");
    }
  }

  async function refreshSegments(documentId: string) {
    segmentsDocumentId.value = documentId;
    segmentsLoading.value = true;
    try {
      const response = await adminListSegments(documentId);
      segments.value = response.segments;
      segmentsTotal.value = response.total;
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载片段失败");
    } finally {
      segmentsLoading.value = false;
    }
  }

  async function handleUpdateSegment(documentId: string, pointId: string, text: string) {
    try {
      await adminUpdateSegment(documentId, pointId, text);
      messageApi.success("片段更新成功");
      await refreshSegments(documentId);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "更新片段失败");
    }
  }

  async function handleDeleteSegment(documentId: string, pointId: string) {
    try {
      await adminDeleteSegment(documentId, pointId);
      messageApi.success("片段删除成功");
      await refreshSegments(documentId);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "删除片段失败");
    }
  }

  async function handleReindexDocument(documentId: string) {
    try {
      const result = await adminReindexDocument(documentId);
      messageApi.success(`重新索引完成，删除 ${result.deletedSegments} 段，新增 ${result.newSegments} 段`);
      await refreshSegments(documentId);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "重新索引失败");
    }
  }

  return {
    users,
    usersLoading,
    roles,
    rolesLoading,
    permissions,
    permissionsLoading,
    prompts,
    promptsLoading,
    segments,
    segmentsLoading,
    segmentsTotal,
    segmentsDocumentId,
    refreshUsers,
    handleCreateUser,
    handleUpdateUser,
    handleDeleteUser,
    handleResetUserPassword,
    refreshRoles,
    handleCreateRole,
    handleUpdateRole,
    handleDeleteRole,
    refreshPermissions,
    handleChangePassword,
    refreshPrompts,
    handleUpdatePrompt,
    handleResetPrompt,
    refreshSegments,
    handleUpdateSegment,
    handleDeleteSegment,
    handleReindexDocument
  };
}
