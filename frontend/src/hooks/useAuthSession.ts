import { useEffect, useState } from "react";
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
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse>(ANONYMOUS_STATUS);
  const [authLoading, setAuthLoading] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [registrationCodes, setRegistrationCodes] = useState<RegistrationCode[]>([]);
  const [registrationCodesLoading, setRegistrationCodesLoading] = useState(false);
  const [codeCreating, setCodeCreating] = useState(false);
  const [codeMutatingId, setCodeMutatingId] = useState<number | null>(null);

  useEffect(() => {
    void refreshSession(true);
  }, []);

  useEffect(() => {
    if (authStatus.authenticated && authStatus.user?.role === "ADMIN") {
      void refreshRegistrationCodes(true);
      return;
    }

    setRegistrationCodes([]);
    setRegistrationCodesLoading(false);
  }, [authStatus.authenticated, authStatus.user?.role]);

  async function refreshSession(silent = false) {
    if (!silent) {
      setAuthLoading(true);
    }

    try {
      const response = await getAuthStatus();
      setAuthStatus(response);
    } catch (error) {
      setAuthStatus(ANONYMOUS_STATUS);
      if (!silent) {
        messageApi.error(error instanceof Error ? error.message : "鉴权状态检查失败");
      }
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogin(username: string, password: string) {
    setAuthSubmitting(true);

    try {
      const response = await login(username, password);
      setAuthStatus({ authenticated: true, user: response.user });
      messageApi.success(response.message);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleRegister(username: string, password: string, registrationCodeValue: string) {
    setAuthSubmitting(true);

    try {
      const response = await register(username, password, registrationCodeValue);
      setAuthStatus({ authenticated: true, user: response.user });
      messageApi.success(response.message);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "注册失败");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    setAuthSubmitting(true);

    try {
      const response = await logout();
      setAuthStatus(ANONYMOUS_STATUS);
      setRegistrationCodes([]);
      messageApi.success(response.message);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "退出失败");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function refreshRegistrationCodes(silent = false) {
    if (authStatus.user?.role !== "ADMIN") {
      return;
    }

    setRegistrationCodesLoading(true);

    try {
      const response = await listRegistrationCodes();
      setRegistrationCodes(response.codes);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await handleUnauthorized(false);
        return;
      }

      if (!silent) {
        messageApi.error(error instanceof Error ? error.message : "加载注册码失败");
      }
    } finally {
      setRegistrationCodesLoading(false);
    }
  }

  async function handleCreateRegistrationCode(note: string, expiresAt: string | null) {
    setCodeCreating(true);

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
      setCodeCreating(false);
    }
  }

  async function handleDisableRegistrationCode(id: number) {
    setCodeMutatingId(id);

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
      setCodeMutatingId(null);
    }
  }

  async function handleDeleteRegistrationCode(id: number) {
    setCodeMutatingId(id);

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
      setCodeMutatingId(null);
    }
  }

  async function handleUnauthorized(showMessage = true) {
    setAuthStatus(ANONYMOUS_STATUS);
    setRegistrationCodes([]);
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
