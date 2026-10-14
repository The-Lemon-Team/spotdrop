import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

// Simple zero-dependency .env loader
if (fs.existsSync(envPath)) {
  try {
    const raw = fs.readFileSync(envPath, 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (key && process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  } catch (err) {
    console.warn('Could not read .env file:', err.message);
  }
}

export const AUTH_TOKEN = (process.env.SPOTDROP_AUTH_TOKEN || process.env.AUTH_TOKEN || '').trim();
export const REQUIRE_AUTH = Boolean(AUTH_TOKEN);
export const PORT = parseInt(process.env.PORT || '3001', 10);
export const HOST = process.env.HOST || '0.0.0.0';

/**
 * Extracts auth token from request headers, cookies, or query parameters
 */
export function extractToken(req, url) {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      return parts[1].trim();
    }
    return authHeader.trim();
  }

  if (req.headers['x-access-token']) {
    return req.headers['x-access-token'].trim();
  }
  if (req.headers['x-auth-token']) {
    return req.headers['x-auth-token'].trim();
  }

  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)(?:token|spotdrop_token)=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1].trim());
    }
  }

  if (url) {
    if (url.searchParams.has('token')) {
      return url.searchParams.get('token').trim();
    }
    if (url.searchParams.has('auth')) {
      return url.searchParams.get('auth').trim();
    }
  }

  return null;
}

/**
 * Verifies if request is authorized (returns true if auth is disabled)
 */
export function isAuthorized(req, url) {
  if (!REQUIRE_AUTH) return true;
  const token = extractToken(req, url);
  return token === AUTH_TOKEN;
}

/**
 * Finds Tailscale IPv4 address from network interfaces
 */
export function getTailscaleIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    if (/tailscale/i.test(name)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  }
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal && net.address.startsWith('100.')) {
        return net.address;
      }
    }
  }
  return null;
}

/**
 * Finds LAN IPv4 address
 */
export function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    if (/tailscale|loopback|pseudo|vethernet/i.test(name)) continue;
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('127.')) {
        return net.address;
      }
    }
  }
  return null;
}
