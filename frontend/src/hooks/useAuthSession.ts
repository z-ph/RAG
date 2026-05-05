import { useEffect, useState } from "react";
import {
  ApiError,
  getAuthStatus,
  login,
  logout,
  register
} from "../lib/api";
import { clearTokens, hasToken, setTokens } from "../lib/tokenStorage";
import type { AuthStatusResponse } from "../types";

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

  useEffect(() => {
    void refreshSession(true);
  }, []);

  async function refreshSession(silent = false) {
    if (!silent) {
      setAuthLoading(true);
    }

    if (!hasToken()) {
      setAuthStatus(ANONYMOUS_STATUS);
      setAuthLoading(false);
      return;
    }

    try {
      const response = await getAuthStatus();
      setAuthStatus(response);
    } catch (error) {
      setAuthStatus(ANONYMOUS_STATUS);
      clearTokens();
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
      setTokens(response.accessToken, response.refreshToken);
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
      setTokens(response.accessToken, response.refreshToken);
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
      clearTokens();
      setAuthStatus(ANONYMOUS_STATUS);
      messageApi.success(response.message);
    } catch (error) {
      clearTokens();
      setAuthStatus(ANONYMOUS_STATUS);
      messageApi.error(error instanceof Error ? error.message : "退出失败");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleUnauthorized(showMessage = true) {
    clearTokens();
    setAuthStatus(ANONYMOUS_STATUS);
    if (showMessage) {
      messageApi.error("登录状态已失效，请重新登录");
    }
  }

  return {
    authStatus,
    authLoading,
    authSubmitting,
    refreshSession,
    handleLogin,
    handleRegister,
    handleLogout,
    handleUnauthorized
  };
}
