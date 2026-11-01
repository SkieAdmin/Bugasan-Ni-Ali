// Settings read from environment variables (see .env.example).
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Reports group sales by day, so dates must be in the store's time zone, not the server's.
process.env.TZ = process.env.TZ || 'Asia/Manila';

const env = process.env;
const isProduction = env.NODE_ENV === 'production';
const isTest = env.NODE_ENV === 'test';
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function jwtSecret() {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  if (isProduction) throw new Error('JWT_SECRET must be set in production (see .env.example).');
  console.warn('[config] JWT_SECRET is not set. Using a random one, so logins reset on every restart.');
  return crypto.randomBytes(32).toString('hex');
}

// Express accepts true/false, a hop count, or names like "loopback".
function trustProxy(value = 'loopback') {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

function dbPath(value = 'data/bugasan.db') {
  return value === ':memory:' ? value : path.resolve(rootDir, value);
}

// Push notifications go through Expo's service, so there are no Firebase/APNs keys to keep here.
// An access token is only needed if you turn on "enhanced security" for push in your Expo account.
function push() {
  const enabled = env.PUSH_ENABLED ? env.PUSH_ENABLED !== 'false' : !isTest;
  return {
    enabled,
    accessToken: env.EXPO_ACCESS_TOKEN || '',
    sendUrl: env.EXPO_PUSH_URL || 'https://exp.host/--/api/v2/push/send',
    receiptUrl: env.EXPO_RECEIPT_URL || 'https://exp.host/--/api/v2/push/getReceipts',
  };
}

export const config = {
  isProduction,
  isTest,
  port: Number(env.PORT) || 3000,
  // Behind nginx the API should only listen on localhost. In development it listens on all
  // interfaces so Expo Go on a phone can reach it over Wi-Fi.
  host: env.HOST || (isProduction ? '127.0.0.1' : '0.0.0.0'),
  dbPath: dbPath(env.DB_PATH),
  jwtSecret: jwtSecret(),
  jwtExpiresIn: env.JWT_EXPIRES_IN || '30d',
  corsOrigins: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((o) => o.trim()) : '*',
  trustProxy: trustProxy(env.TRUST_PROXY),
  push: push(),
};
