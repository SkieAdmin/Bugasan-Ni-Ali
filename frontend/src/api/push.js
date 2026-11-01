// Push notifications on the phone: permission, the Expo push token, and the Android channel.
//
// The token identifies this phone to Expo's push service. AppContext sends it to the backend
// (POST /me/devices) after login and removes it again on logout, so notifications always follow
// whoever is logged in on this device.
//
// Notifications need a development build or a release build — remote push does not work in
// Expo Go on Android. On a simulator there is no token either; both cases report `supported: false`
// instead of failing, so the rest of the app carries on normally.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { api } from './client';

export const ANDROID_CHANNEL = 'orders';

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
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: 'Order updates',
    description: 'Order status, payments and wholesale applications.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1E6B47',
    sound: 'default',
  });
}

// Has the user already allowed notifications? Never asks.
export async function permissionStatus() {
  if (unsupportedReason()) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status; // 'granted' | 'denied' | 'undetermined'
}

// Asks for permission if it has not been answered yet, then gets this phone's Expo token.
// Resolves to { ok, token } or { ok: false, reason } — it never throws.
export async function getPushToken({ ask = true } = {}) {
  const unsupported = unsupportedReason();
  if (unsupported) return { ok: false, reason: unsupported, status: 'unsupported' };

  try {
    await ensureAndroidChannel();

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask) ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') {
      return {
        ok: false,
        status,
        reason: 'Notifications are turned off for this app. You can switch them on in the phone settings.',
      };
    }

    const id = projectId();
    if (!id) {
      return {
        ok: false,
        status,
        reason: 'This build has no EAS project id yet. Run `npx eas init` in the frontend folder.',
      };
    }

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    return { ok: true, token: data, status };
  } catch (err) {
    return { ok: false, status: 'error', reason: err?.message || 'Could not set up notifications on this phone.' };
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
