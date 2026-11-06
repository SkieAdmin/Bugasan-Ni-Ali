// Push notifications on the phone: permission, the Expo push token, and the Android channel.
//
// The token identifies this phone to Expo's push service. AppContext sends it to the backend
// (POST /me/devices) after login and removes it again on logout, so notifications always follow
// whoever is logged in on this device.
//
// Notifications need a development build or a release build — remote push does not work in
// Expo Go on Android. On a simulator there is no token either; both cases report `supported: false`
// instead of failing, so the rest of the app carries on normally.
//
// Getting a token also needs an EAS project id and, on Android, Firebase (google-services.json)
// in the build — see frontend/README.md. A build without them still notifies: the phone makes
// the notifications itself from the data it syncs (src/notifications/alerts.js). The mode in use
// is saved, so the background task knows it too:
//   'remote' — the backend pushes to this phone
//   'local'  — this phone makes its own notifications
//   'off'    — the user switched them off in the app

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { api } from './client';

export const ANDROID_CHANNEL = 'orders';

const MODE_KEY = 'bugasan-ni-ali.push-mode';

export async function loadPushMode() {
  try {
    return await AsyncStorage.getItem(MODE_KEY);
  } catch {
    return null;
  }
}

// `null` forgets it (logout): the next login asks again.
export async function savePushMode(mode) {
  try {
    if (mode) await AsyncStorage.setItem(MODE_KEY, mode);
    else await AsyncStorage.removeItem(MODE_KEY);
  } catch {
    // Storage unavailable: worked out again on the next start.
  }
}

// What the app does with a notification that arrives while it is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Why this phone cannot receive notifications, or null when it can.
export function unsupportedReason() {
  if (Platform.OS === 'web') return 'Push notifications only work in the phone app.';
  if (!Device.isDevice) return 'Push notifications need a real phone, not a simulator.';
  if (isExpoGo && Platform.OS === 'android') {
    return 'Expo Go cannot receive push notifications. Use a development build (npx expo run:android).';
  }
  return null;
}

// Expo needs the EAS project id to issue a token outside Expo Go. `npx eas init` writes it
// into app.json for you.
function projectId() {
  return Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || null;
}

// Android shows notifications through channels; this one is created before the first arrives
// so it gets a sound and the store's green colour instead of the system default.
let channelReady = null;
function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelReady ??= Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: 'Order updates',
    description: 'Order status, payments and wholesale applications.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1E6B47',
    sound: 'default',
  }).catch((err) => {
    channelReady = null; // try again next time
    throw err;
  });
  return channelReady;
}

// Shows a notification right away, made on this phone (no server involved).
export async function showLocalNotification({ title, body, data }) {
  await ensureAndroidChannel();
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data: { ...data, local: true }, sound: 'default', color: '#1E6B47' },
    trigger: Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : null,
  });
}

// Has the user already allowed notifications? Never asks.
export async function permissionStatus() {
  if (unsupportedReason()) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status; // 'granted' | 'denied' | 'undetermined'
}

// Asks for permission if it has not been answered yet, then gets this phone's Expo token.
// Resolves to { ok, token } or { ok: false, status, reason } — it never throws.
// `status: 'granted'` with `ok: false` means the phone allows notifications but this build
// cannot receive push from the server, so the app makes its own (see the top of this file).
export async function getPushToken({ ask = true } = {}) {
  const unsupported = unsupportedReason();
  if (unsupported) return { ok: false, reason: unsupported, status: 'unsupported' };

  let status;
  try {
    await ensureAndroidChannel();

    ({ status } = await Notifications.getPermissionsAsync());
    if (status !== 'granted' && ask) ({ status } = await Notifications.requestPermissionsAsync());
  } catch (err) {
    return { ok: false, status: 'error', reason: err?.message || 'Could not set up notifications on this phone.' };
  }
  if (status !== 'granted') {
    return {
      ok: false,
      status,
      reason: 'Notifications are turned off for this app. You can switch them on in the phone settings.',
    };
  }

  const id = projectId();
  if (!id) return { ok: false, status, reason: 'No EAS project id in this build (npx eas init).' };

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    return { ok: true, token: data, status };
  } catch (err) {
    // Usually Firebase is missing from the build (google-services.json).
    return { ok: false, status, reason: err?.message || 'Could not get a push token.' };
  }
}

const deviceName = () => [Device.manufacturer, Device.modelName].filter(Boolean).join(' ').slice(0, 80);

// Tells the backend to send this phone's notifications to this token.
export function saveToken(token) {
  return api.post('/me/devices', { token, platform: Platform.OS, deviceName: deviceName() });
}

// On logout, so the next person on this phone does not get the previous user's notifications.
export function forgetToken(token) {
  return api.delete(`/me/devices/${encodeURIComponent(token)}`);
}

// "Send a test notification" in the app.
export function sendTestNotification() {
  return api.post('/me/devices/test');
}

// Clears the little number on the app icon (iOS).
export function clearBadge() {
  return Notifications.setBadgeCountAsync(0).catch(() => {});
}
