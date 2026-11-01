// Push notifications through Expo's push service (https://docs.expo.dev/push-notifications/sending-notifications/).
//
// The app registers its Expo push token after logging in (POST /api/me/devices) and drops it
// again on logout. Everything here is best effort: a notification that cannot be delivered must
// never fail the order or the request that triggered it, so `notify*` never throws and never
// makes the caller wait.

import { db } from '../db/index.js';
import { config } from '../config.js';
import { badRequest } from '../lib/errors.js';
import { nowIso } from '../lib/ids.js';

// Expo tokens look like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx].
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export const isExpoPushToken = (token) => EXPO_TOKEN.test(String(token || '').trim());

// Expo accepts at most 100 messages per request.
const CHUNK = 100;

// Delivery can take a few seconds; the caller is never kept waiting for it.
const SEND_TIMEOUT_MS = 10000;

// Receipts say whether the phone really got the notification. They are ready a few
// seconds after sending.
const RECEIPT_DELAY_MS = 15000;

// ---------- Devices ----------

const toDevice = (row) => ({
  token: row.token,
  platform: row.platform,
  deviceName: row.device_name,
  createdAt: row.created_at,
  lastSeenAt: row.last_seen_at,
});

export function listDevices(userId) {
  return db.prepare('SELECT * FROM device_tokens WHERE user_id = ? ORDER BY last_seen_at DESC').all(userId).map(toDevice);
}

// Saves (or refreshes) the push token of one phone. The token is the primary key: if this
// device was logged in as someone else before, the row moves to the new user so the previous
// account's notifications stop arriving on it.
export function registerDevice(userId, { token, platform = 'unknown', deviceName = '' }) {
  const value = String(token).trim();
  if (!isExpoPushToken(value)) throw badRequest('That is not a valid Expo push token.', { token: 'Invalid push token.' });
  const at = nowIso();
  db.prepare(
    `INSERT INTO device_tokens (token, user_id, platform, device_name, created_at, last_seen_at)
     VALUES (@token, @userId, @platform, @deviceName, @at, @at)
     ON CONFLICT (token) DO UPDATE SET
       user_id      = excluded.user_id,
       platform     = excluded.platform,
       device_name  = excluded.device_name,
       last_seen_at = excluded.last_seen_at`
  ).run({ token: value, userId, platform, deviceName, at });
  return toDevice(db.prepare('SELECT * FROM device_tokens WHERE token = ?').get(value));
}

// On logout. Only removes the caller's own device, so one account cannot silence another.
export function unregisterDevice(userId, token) {
  return db.prepare('DELETE FROM device_tokens WHERE token = ? AND user_id = ?').run(String(token).trim(), userId).changes > 0;
}

// Every device of one account, e.g. after a password change logs them all out.
export function forgetUserDevices(userId) {
  return db.prepare('DELETE FROM device_tokens WHERE user_id = ?').run(userId).changes;
}

export function removeTokens(tokens) {
  if (!tokens.length) return;
  const remove = db.prepare('DELETE FROM device_tokens WHERE token = ?');
  tokens.forEach((token) => remove.run(token));
}

const tokensForUser = (userId) => db.prepare('SELECT token FROM device_tokens WHERE user_id = ?').pluck().all(userId);

const tokensForAdmins = () =>
  db.prepare("SELECT d.token FROM device_tokens d JOIN users u ON u.id = d.user_id WHERE u.role = 'admin'").pluck().all();

// ---------- Delivery ----------

// Tests (and anyone who wants to log instead of send) replace the transport with their own.
let transport = sendToExpo;

export function setPushTransport(fn) {
  const previous = transport;
  transport = fn || sendToExpo;
  return previous;
}

const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

function expoHeaders() {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(config.push.accessToken && { Authorization: `Bearer ${config.push.accessToken}` }),
  };
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: expoHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Expo push service answered ${res.status}`);
  return res.json();
}

// Sends one batch and returns the tickets Expo gives back, in the same order as `messages`.
async function sendToExpo(messages) {
  const { data } = await postJson(config.push.sendUrl, messages);
  return Array.isArray(data) ? data : [];
}

// A token Expo rejects outright is dead: the app was uninstalled or the token was replaced.
const isDeadToken = (ticket) => ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered';

// Expo reports most failures in the receipt, not in the ticket, so tokens are cleaned up here too.
async function checkReceipts(ticketIdsByToken) {
  const ids = [...ticketIdsByToken.keys()];
  if (!ids.length) return;
  try {
    const { data } = await postJson(config.push.receiptUrl, { ids });
    const dead = Object.entries(data || {})
      .filter(([, receipt]) => isDeadToken(receipt))
      .map(([ticketId]) => ticketIdsByToken.get(ticketId))
      .filter(Boolean);
    if (dead.length) {
      removeTokens(dead);
      console.log(`[push] removed ${dead.length} uninstalled device(s)`);
    }
  } catch (err) {
    console.warn('[push] could not read delivery receipts:', err.message);
  }
}

// Sends one message to a list of tokens. Resolves to the number of phones Expo accepted it for.
async function send(tokens, { title, body, data }) {
  if (!config.push.enabled || !tokens.length) return 0;

  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    data: data || {},
    sound: 'default',
    priority: 'high',
    channelId: 'orders', // created by the app (frontend/src/api/push.js)
  }));

  let accepted = 0;
  const receipts = new Map();

  for (const batch of chunks(messages, CHUNK)) {
    let tickets;
    try {
      tickets = await transport(batch);
    } catch (err) {
      console.warn('[push] could not reach the Expo push service:', err.message);
      continue;
    }

    const dead = [];
    tickets.forEach((ticket, i) => {
      const token = batch[i].to;
      if (ticket?.status === 'ok') {
        accepted += 1;
        if (ticket.id) receipts.set(ticket.id, token);
      } else if (isDeadToken(ticket)) {
        dead.push(token);
      } else if (ticket?.status === 'error') {
        console.warn(`[push] ${token}: ${ticket.message}`);
      }
    });
    if (dead.length) removeTokens(dead);
  }

  // unref() so a pending receipt check never keeps the server (or `npm test`) running.
  if (receipts.size) setTimeout(() => checkReceipts(receipts), RECEIPT_DELAY_MS).unref?.();
  return accepted;
}

// ---------- What the rest of the app calls ----------

// Fire and forget: the caller is not kept waiting and a push failure never breaks the request.
function fireAndForget(tokens, message) {
  if (!message || !tokens.length) return;
  send(tokens, message).catch((err) => console.warn('[push] send failed:', err.message));
}

export function notifyUser(userId, message) {
  fireAndForget(tokensForUser(userId), message);
}

export function notifyAdmins(message) {
  fireAndForget(tokensForAdmins(), message);
}

// Used by POST /api/me/devices/test so the user can check notifications really arrive.
export function sendTestNotification(userId) {
  return send(tokensForUser(userId), {
    title: 'Bugasan ni Ali',
    body: 'Push notifications are working on this phone. 🌾',
    data: { screen: 'home', test: true },
  });
}
