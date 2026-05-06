import { useEffect, useSyncExternalStore } from "react";
import {
  getAuthStatus,
  login,
  logout,
  register
} from "../lib/api";
import {
  ANONYMOUS_AUTH_STATUS,
  getAuthSessionSnapshot,
  hasInitializedAuthSession,
  setAnonymousAuthSession,
  setAuthLoading,
  setAuthSessionStatus,
  setAuthSubmitting,
  subscribeAuthSession
} from "../lib/authStore";
import { refreshStoredAccessToken } from "../lib/httpClient";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  hasStoredTokens,
  setTokens
} from "../lib/tokenStorage";

interface MessageApi {
  error: (content: string) => void;
  success: (content: string) => void;
}

let bootstrapPromise: Promise<void> | null = null;

function getErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error.message : fallbackMessage;
}

async function syncAuthStatus(messageApi: MessageApi, silent = false) {
  if (!silent) {
    setAuthLoading(true);
  }

  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  if (!accessToken && !refreshToken) {
    setAnonymousAuthSession({
      authLoading: false,
      initialized: true
    });
    return;
  }

  try {
    if (!accessToken && refreshToken) {
      const refreshed = await refreshStoredAccessToken();

      if (!refreshed && !getAccessToken()) {
        setAnonymousAuthSession({
          authLoading: false,
          initialized: true
        });

        if (!silent) {
          messageApi.error("登录状态检查失败");
        }
        return;
      }
    }

    const response = await getAuthStatus();

    if (response.authenticated && response.user) {
      setAuthSessionStatus(response, {
        authLoading: false,
        initialized: true
      });
      return;
    }

    clearTokens();
    setAnonymousAuthSession({
      authLoading: false,
      initialized: true
    });
  } catch (error) {
    clearTokens();
    setAnonymousAuthSession({
      authLoading: false,
      initialized: true
    });
    if (!silent) {
      messageApi.error(getErrorMessage(error, "鉴权状态检查失败"));
    }
  }
}

async function ensureAuthSessionInitialized(messageApi: MessageApi) {
  if (hasInitializedAuthSession()) {
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = syncAuthStatus(messageApi, true).finally(() => {
      bootstrapPromise = null;
    });
  }

  await bootstrapPromise;
}

export function useAuthSession(messageApi: MessageApi) {
  const { authStatus, authLoading, authSubmitting } = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionSnapshot
  );

  useEffect(() => {
    void ensureAuthSessionInitialized(messageApi);
  }, [messageApi]);

  async function refreshSession(silent = false) {
    if (!hasStoredTokens()) {
      setAnonymousAuthSession({
        authLoading: false,
        initialized: true
      });
      return;
    }

    await syncAuthStatus(messageApi, silent);
  }

  async function handleLogin(username: string, password: string) {
    setAuthSubmitting(true);

    try {
      const response = await login(username, password);
      setTokens(response.accessToken, response.refreshToken);
      setAuthSessionStatus({ authenticated: true, user: response.user }, {
        authLoading: false,
        authSubmitting: true,
        initialized: true
      });
      messageApi.success(response.message);
    } catch (error) {
      messageApi.error(getErrorMessage(error, "登录失败"));
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleRegister(username: string, password: string, registrationCodeValue: string) {
    setAuthSubmitting(true);

    try {
      const response = await register(username, password, registrationCodeValue);
      setTokens(response.accessToken, response.refreshToken);
      setAuthSessionStatus({ authenticated: true, user: response.user }, {
        authLoading: false,
        authSubmitting: true,
        initialized: true
      });
      messageApi.success(response.message);
    } catch (error) {
      messageApi.error(getErrorMessage(error, "注册失败"));
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    setAuthSubmitting(true);

    try {
      const response = await logout();
      clearTokens();
      setAnonymousAuthSession({
        authLoading: false,
        authSubmitting: true,
        initialized: true
      });
      messageApi.success(response.message);
    } catch (error) {
      clearTokens();
      setAnonymousAuthSession({
        authLoading: false,
        authSubmitting: true,
        initialized: true
      });
      messageApi.error(getErrorMessage(error, "退出失败"));
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleUnauthorized(showMessage = true) {
    clearTokens();
    setAuthSessionStatus(ANONYMOUS_AUTH_STATUS, {
      authLoading: false,
      authSubmitting: false,
      initialized: true
    });
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

export type AuthSessionState = ReturnType<typeof useAuthSession>;
