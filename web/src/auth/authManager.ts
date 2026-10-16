/**
 * SpotDrop Network & API Client
 * Supports seamless switching between Web (relative API) and Tauri Desktop (local embedded server).
 */

export interface NetworkInfo {
  tailscaleIp: string | null;
  lanIp: string | null;
  port: number;
  hostname: string;
  funnelHost?: string;
  funnelUrl?: string;
}

export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

export const DEFAULT_DESKTOP_SERVER = 'http://127.0.0.1:3003';

export function getApiBaseUrl(): string {
  if (isTauriEnvironment()) {
    return DEFAULT_DESKTOP_SERVER;
  }
  return '';
}

export function resolveApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

/**
 * Standard API fetch wrapper
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = resolveApiUrl(input);
  return await fetch(url, init);
}

/**
 * Constructs direct audio stream URL for HTML5 Audio element
 */
export function getAudioStreamUrl(videoId: string, profileId?: string): string {
  let base = `${getApiBaseUrl()}/api/stream?videoId=${encodeURIComponent(videoId)}`;
  if (profileId) {
    base += `&profileId=${encodeURIComponent(profileId)}`;
  }
  return base;
}

/**
 * Fetches server Tailscale and network connection info
 */
export async function getNetworkInfo(): Promise<NetworkInfo | null> {
  try {
    const res = await apiFetch('/api/network-info');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
