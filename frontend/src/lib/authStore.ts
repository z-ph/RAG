import type { AuthStatusResponse } from "../types";

interface AuthSessionState {
  authStatus: AuthStatusResponse;
  authLoading: boolean;
  authSubmitting: boolean;
  initialized: boolean;
}

const ANONYMOUS_AUTH_STATUS: AuthStatusResponse = {
  authenticated: false,
  user: null
};

let authSessionState: AuthSessionState = {
  authStatus: ANONYMOUS_AUTH_STATUS,
  authLoading: true,
  authSubmitting: false,
  initialized: false
};

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function updateAuthSessionState(nextState: AuthSessionState) {
  authSessionState = nextState;
  emitChange();
}

export function subscribeAuthSession(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getAuthSessionSnapshot() {
  return authSessionState;
}

export function setAuthLoading(authLoading: boolean) {
  if (authSessionState.authLoading === authLoading) {
    return;
  }

  updateAuthSessionState({
    ...authSessionState,
    authLoading
  });
}

export function setAuthSubmitting(authSubmitting: boolean) {
  if (authSessionState.authSubmitting === authSubmitting) {
    return;
  }

  updateAuthSessionState({
    ...authSessionState,
    authSubmitting
  });
}

export function setAuthSessionStatus(
  authStatus: AuthStatusResponse,
  options?: Partial<Pick<AuthSessionState, "authLoading" | "authSubmitting" | "initialized">>
) {
  updateAuthSessionState({
    authStatus,
    authLoading: options?.authLoading ?? false,
    authSubmitting: options?.authSubmitting ?? authSessionState.authSubmitting,
    initialized: options?.initialized ?? true
  });
}

export function setAnonymousAuthSession(
  options?: Partial<Pick<AuthSessionState, "authLoading" | "authSubmitting" | "initialized">>
) {
  setAuthSessionStatus(ANONYMOUS_AUTH_STATUS, {
    authLoading: options?.authLoading,
    authSubmitting: options?.authSubmitting ?? false,
    initialized: options?.initialized
  });
}

export function hasInitializedAuthSession() {
  return authSessionState.initialized;
}

export { ANONYMOUS_AUTH_STATUS };
