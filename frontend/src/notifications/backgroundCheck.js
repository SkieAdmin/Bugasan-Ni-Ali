// Looks for order updates while the app is closed, so the phone still gets its notifications.
//
// Android runs this task on its own schedule (at most every 15 minutes, less often when the
// battery is low) and can start the app in the background just for it. That is why the task is
// defined here, imported first thing by the app entry (index.js), and not inside a screen.
//
// Only used when the phone makes its own notifications (src/notifications/alerts.js). With real
// push the backend reaches the phone directly and this task is switched off.

import { Platform } from 'react-native';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { getAuthToken, setAuthToken } from '../api/client';
import { loadPushMode } from '../api/push';
import { loadSession } from '../api/session';
import { checkForUpdates, fetchUpdates } from './alerts';

const TASK = 'bugasan-ni-ali.check-for-updates';

// Minutes. Android never runs it more often than every 15.
const EVERY_MINUTES = 15;

TaskManager.defineTask(TASK, async () => {
  try {
    if ((await loadPushMode()) !== 'local') return BackgroundTask.BackgroundTaskResult.Success;
    const session = await loadSession();
    if (!session?.token || !session.user) return BackgroundTask.BackgroundTaskResult.Success;
    // Started with the app closed, nothing has set the login token yet.
    if (!getAuthToken()) setAuthToken(session.token);
    await checkForUpdates(session.user, await fetchUpdates(session.user));
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (err) {
    console.warn('[background] could not check for updates:', err?.message);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function startBackgroundChecks() {
  if (Platform.OS === 'web') return;
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (!(await TaskManager.isTaskRegisteredAsync(TASK))) {
      await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: EVERY_MINUTES });
    }
  } catch (err) {
    console.warn('[background] could not schedule update checks:', err?.message);
  }
}

export async function stopBackgroundChecks() {
  if (Platform.OS === 'web') return;
  try {
    if (await TaskManager.isTaskRegisteredAsync(TASK)) await BackgroundTask.unregisterTaskAsync(TASK);
  } catch {
    // Not registered.
  }
}
