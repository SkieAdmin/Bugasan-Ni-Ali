// Keeps the login on the device so the app stays logged in after it is closed.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'bugasan-ni-ali.session';

export async function loadSession() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveSession(session) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Storage full or unavailable: the user just has to log in again next time.
  }
}

export async function clearSession() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
