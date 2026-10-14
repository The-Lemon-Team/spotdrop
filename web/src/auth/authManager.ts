/**
 * SpotDrop Network & API Client
 * Token authentication has been removed in favor of unique URL routing (/p/:profileId).
 */

export interface NetworkInfo {
  tailscaleIp: string | null;
  lanIp: string | null;
  port: number;
  hostname: string;
  funnelHost?: string;
  funnelUrl?: string;
}

/**
 * Standard API fetch wrapper
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return await fetch(input, init);
}

/**
 * Constructs direct audio stream URL for HTML5 Audio element
 */
export function getAudioStreamUrl(videoId: string, profileId?: string): string {
  let base = `/api/stream?videoId=${encodeURIComponent(videoId)}`;
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
    const res = await fetch('/api/network-info');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
