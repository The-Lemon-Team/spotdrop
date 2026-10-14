const TOKEN_STORAGE_KEY = 'bandita_auth_token';

type AuthListener = (isAuthenticated: boolean) => void;
const listeners = new Set<AuthListener>();

function notifyListeners(auth: boolean) {
  listeners.forEach((fn) => {
    try {
      fn(auth);
    } catch (e) {
      console.error(e);
    }
  });
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([$?*|{}\[\]\\\/^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0`;
}

/**
 * Retrieves the active access token from URL parameters, localStorage, or cookies.
 * If a token is detected in the URL query string, it is automatically persisted
 * and stripped from the browser address bar for user privacy.
 */
export function getStoredToken(): string {
  if (typeof window === 'undefined') return '';

  // 1. Check URL parameters (?token=... or ?auth=...)
  try {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token') || params.get('auth');
    if (tokenFromUrl && tokenFromUrl.trim()) {
      const cleanToken = tokenFromUrl.trim();
      setStoredToken(cleanToken);

      // Clean the URL without page reload
      params.delete('token');
      params.delete('auth');
      const newQuery = params.toString();
      const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : '') + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);

      return cleanToken;
    }
  } catch (err) {
    console.warn('Error reading token from URL:', err);
  }

  // 2. Check localStorage
  const local = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (local && local.trim()) {
    return local.trim();
  }

  // 3. Check Cookie
  const cookieVal = getCookie('token') || getCookie('bandita_token');
  if (cookieVal && cookieVal.trim()) {
    return cookieVal.trim();
  }

  return '';
}

/**
 * Persists token to localStorage and long-lived cookie
 */
export function setStoredToken(token: string): void {
  const clean = token.trim();
  if (clean) {
    localStorage.setItem(TOKEN_STORAGE_KEY, clean);
    setCookie('token', clean);
    setCookie('bandita_token', clean);
    notifyListeners(true);
  }
}

/**
 * Removes token from all client storages
 */
export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  deleteCookie('token');
  deleteCookie('bandita_token');
  notifyListeners(false);
}

export function subscribeAuth(listener: AuthListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Verifies access token with the server
 */
export async function verifyToken(
  tokenToTest?: string
): Promise<{ valid: boolean; tailscaleIp?: string; error?: string }> {
  const token = tokenToTest !== undefined ? tokenToTest.trim() : getStoredToken();
  if (!token) {
    return { valid: false, error: 'Токен не указан' };
  }

  try {
    const url = `/api/auth/verify?token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Access-Token': token,
      },
    });

    if (res.ok) {
      const data = await res.json();
      setStoredToken(token);
      return { valid: true, tailscaleIp: data.tailscaleIp };
    } else {
      return { valid: false, error: 'Неверный токен доступа' };
    }
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Сетевая ошибка при проверке токена',
    };
  }
}

/**
 * Wrapper around standard fetch that automatically attaches the access token
 * via headers and query string. Automatically handles 401 responses.
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers || {});

  if (token) {
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('X-Access-Token')) {
      headers.set('X-Access-Token', token);
    }
  }

  // Also append token query parameter if not present
  let url = input;
  if (token) {
    const separator = url.includes('?') ? '&' : '?';
    if (!url.includes('token=') && !url.includes('auth=')) {
      url = `${url}${separator}token=${encodeURIComponent(token)}`;
    }
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (res.status === 401) {
    console.warn('API returned 401 Unauthorized. Access token expired or invalid.');
    clearStoredToken();
  }

  return res;
}

/**
 * Constructs an authenticated direct audio stream URL for HTML5 Audio element.
 * Both query param and cookie guarantee playback on iOS Safari & Android Chrome.
 */
export function getAudioStreamUrl(videoId: string, profileId?: string): string {
  const token = getStoredToken();
  let base = `/api/stream?videoId=${encodeURIComponent(videoId)}`;
  if (profileId) {
    base += `&profileId=${encodeURIComponent(profileId)}`;
  }
  if (token) {
    return `${base}&token=${encodeURIComponent(token)}`;
  }
  return base;
}

export interface NetworkInfo {
  tailscaleIp: string | null;
  lanIp: string | null;
  port: number;
  hostname: string;
  funnelHost?: string;
  funnelUrl?: string;
  authRequired: boolean;
}

/**
 * Fetches server Tailscale and network connection info
 */
export async function getNetworkInfo(): Promise<NetworkInfo | null> {
  try {
    const res = await fetch('/api/network-info');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
