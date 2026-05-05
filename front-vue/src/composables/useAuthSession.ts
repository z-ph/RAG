import { onMounted, ref } from "vue";
import {
  ApiError,
  createRegistrationCode,
  deleteRegistrationCode,
  disableRegistrationCode,
  getAuthStatus,
  listRegistrationCodes,
  login,
  logout,
  register
} from "../lib/api";
import { clearTokens, hasToken, setTokens } from "../lib/tokenStorage";
import type { AuthStatusResponse, RegistrationCode } from "../types";

interface MessageApi {
  error: (content: string) => void;
  success: (content: string) => void;
}

const ANONYMOUS_STATUS: AuthStatusResponse = {
  authenticated: false,
  user: null
};

export function useAuthSession(messageApi: MessageApi) {
  const authStatus = ref<AuthStatusResponse>(ANONYMOUS_STATUS);
  const authLoading = ref(true);
  const authSubmitting = ref(false);
  const registrationCodes = ref<RegistrationCode[]>([]);
  const registrationCodesLoading = ref(false);
  const codeCreating = ref(false);
  const codeMutatingId = ref<number | null>(null);

  onMounted(() => {
    void refreshSession(true);
  });

  // Watch for admin role to load registration codes
  function watchAuthForRegistrationCodes() {
    if (authStatus.value.authenticated && authStatus.value.user?.role === "ADMIN") {
      void refreshRegistrationCodes(true);
    } else {
      registrationCodes.value = [];
      registrationCodesLoading.value = false;
    }
  }

  async function refreshSession(silent = false) {
    if (!silent) {
      authLoading.value = true;
    }

    if (!hasToken()) {
      authStatus.value = ANONYMOUS_STATUS;
      authLoading.value = false;
      return;
    }

    try {
      const response = await getAuthStatus();
      authStatus.value = response;
      watchAuthForRegistrationCodes();
    } catch (error) {
      authStatus.value = ANONYMOUS_STATUS;
      clearTokens();
      if (!silent) {
        messageApi.error(error instanceof Error ? error.message : "鉴权状态检查失败");
      }
    } finally {
      authLoading.value = false;
    }
  }

  async function handleLogin(username: string, password: string) {
    authSubmitting.value = true;

    try {
      const response = await login(username, password);
      setTokens(response.accessToken, response.refreshToken);
      authStatus.value = { authenticated: true, user: response.user };
      messageApi.success(response.message);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      authSubmitting.value = false;
    }
  }

  async function handleRegister(username: string, password: string, registrationCodeValue: string) {
    authSubmitting.value = true;

    try {
      const response = await register(username, password, registrationCodeValue);
      setTokens(response.accessToken, response.refreshToken);
      authStatus.value = { authenticated: true, user: response.user };
      messageApi.success(response.message);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "注册失败");
    } finally {
      authSubmitting.value = false;
    }
  }

  async function handleLogout() {
    authSubmitting.value = true;

    try {
      const response = await logout();
      clearTokens();
      authStatus.value = ANONYMOUS_STATUS;
      registrationCodes.value = [];
      messageApi.success(response.message);
    } catch (error) {
      clearTokens();
      authStatus.value = ANONYMOUS_STATUS;
      registrationCodes.value = [];
      messageApi.error(error instanceof Error ? error.message : "退出失败");
    } finally {
      authSubmitting.value = false;
    }
  }

  async function refreshRegistrationCodes(silent = false) {
    if (authStatus.value.user?.role !== "ADMIN") {
      return;
    }

    registrationCodesLoading.value = true;

    try {
      const response = await listRegistrationCodes();
      registrationCodes.value = response.codes;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await handleUnauthorized(false);
        return;
      }

      if (!silent) {
        messageApi.error(error instanceof Error ? error.message : "加载注册码失败");
      }
    } finally {
      registrationCodesLoading.value = false;
    }
  }

  async function handleCreateRegistrationCode(note: string, expiresAt: string | null) {
    codeCreating.value = true;

    try {
      const response = await createRegistrationCode({
        note: note.trim() || null,
        expiresAt: expiresAt || null
      });
      messageApi.success(`注册码已创建：${response.code}`);
      await refreshRegistrationCodes(true);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await handleUnauthorized(false);
        return;
      }

      messageApi.error(error instanceof Error ? error.message : "创建注册码失败");
    } finally {
      codeCreating.value = false;
    }
  }

  async function handleDisableRegistrationCode(id: number) {
    codeMutatingId.value = id;

    try {
      await disableRegistrationCode(id);
      messageApi.success("注册码已禁用");
      await refreshRegistrationCodes(true);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await handleUnauthorized(false);
        return;
      }

      messageApi.error(error instanceof Error ? error.message : "禁用注册码失败");
    } finally {
      codeMutatingId.value = null;
    }
  }

  async function handleDeleteRegistrationCode(id: number) {
    codeMutatingId.value = id;

    try {
      const response = await deleteRegistrationCode(id);
      messageApi.success(response.message);
      await refreshRegistrationCodes(true);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await handleUnauthorized(false);
        return;
      }

      messageApi.error(error instanceof Error ? error.message : "删除注册码失败");
    } finally {
      codeMutatingId.value = null;
    }
  }

  async function handleUnauthorized(showMessage = true) {
    clearTokens();
    authStatus.value = ANONYMOUS_STATUS;
    registrationCodes.value = [];
    if (showMessage) {
      messageApi.error("登录状态已失效，请重新登录");
    }
  }

  return {
    authStatus,
    authLoading,
    authSubmitting,
    registrationCodes,
    registrationCodesLoading,
    codeCreating,
    codeMutatingId,
    refreshSession,
    refreshRegistrationCodes,
    handleLogin,
    handleRegister,
    handleLogout,
    handleCreateRegistrationCode,
    handleDisableRegistrationCode,
    handleDeleteRegistrationCode,
    handleUnauthorized
  };
}
