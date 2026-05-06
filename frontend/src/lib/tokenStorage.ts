const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

export interface StoredTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getStoredTokens(): StoredTokens {
  return {
    accessToken: getAccessToken(),
    refreshToken: getRefreshToken()
  };
}

export function hasStoredTokens(): boolean {
  const { accessToken, refreshToken } = getStoredTokens();
  return !!(accessToken || refreshToken);
}

export function hasToken(): boolean {
  return hasStoredTokens();
}
