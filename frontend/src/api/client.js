// Talks to the Bugasan ni Ali backend. Every request goes through `request`, which adds the
// login token, turns errors into ApiError with a message that can be shown to the user,
// and reports whether the server could be reached (for the network status chip).
import { API_URL } from './config';

const TIMEOUT_MS = 15000;

// Cloudflare / nginx answer with these when the Node server itself is down.
const SERVER_DOWN = [502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 530];

let authToken = null;
let connectionListener = null;
let unauthorizedListener = null;

export class ApiError extends Error {
  constructor(message, status = 0, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export const setAuthToken = (token) => {
  authToken = token;
};
export const getAuthToken = () => authToken;

// fn('online' | 'offline') is called after every request.
export const onConnectionChange = (fn) => {
  connectionListener = fn;
};

// fn(message) is called when the server rejects the saved login (expired or password changed).
export const onUnauthorized = (fn) => {
  unauthorizedListener = fn;
};

export async function request(method, path, body, { timeout = TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const token = authToken;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    connectionListener?.('offline');
    throw new ApiError(
      err?.name === 'AbortError'
        ? 'The server took too long to answer. Please try again.'
        : 'Cannot reach the server. Check your internet connection.'
    );
  } finally {
    clearTimeout(timer);
  }

  if (SERVER_DOWN.includes(res.status)) {
    connectionListener?.('offline');
    throw new ApiError('The server is not available right now. Please try again in a moment.', res.status);
  }
  connectionListener?.('online');

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.ok) return data;

  if (res.status === 401 && token) unauthorizedListener?.(data?.error);
  throw new ApiError(data?.error || `Request failed (${res.status}).`, res.status, data?.fields);
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
  put: (path, body = {}) => request('PUT', path, body),
  patch: (path, body = {}) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
};

// Pings GET /api/health. Resolves true when the backend is up.
export async function checkHealth() {
  let ok = false;
  try {
    const data = await request('GET', '/health', undefined, { timeout: 6000 });
    ok = data?.status === 'ok';
  } catch {
    ok = false;
  }
  connectionListener?.(ok ? 'online' : 'offline');
  return ok;
}
