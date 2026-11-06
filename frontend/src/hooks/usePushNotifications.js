// Reacts to notifications: opens the right screen when one is tapped, and refreshes the data
// when one arrives while the app is open (an order the store just moved along, a new order).
//
// Used once, in the root layout, inside <AppProvider>.

import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useApp } from '../context/AppContext';
import { clearBadge } from '../api/push';

// `data.screen` is set by the backend (backend/src/lib/notifications.js).
function routeFor(data = {}, user) {
  const admin = user?.role === 'admin';
  switch (data.screen) {
    case 'order':
      return data.orderId ? `/order/${data.orderId}` : '/orders';
    case 'admin-order':
      return data.orderId ? `/admin/order/${data.orderId}` : '/admin/orders';
    case 'wholesale':
      return '/admin/wholesale';
    case 'inventory':
      return '/admin/inventory';
    case 'profile':
      return admin ? '/admin/more' : '/profile';
    default:
      return admin ? '/admin' : '/';
  }
}

export function usePushNotifications() {
  const { currentUser, actions } = useApp();
  // The notification that opened the app is delivered once; this stops it reopening on re-render.
  const handled = useRef(null);

  useEffect(() => {
    if (!currentUser) return undefined;

    const open = (response) => {
      const id = response?.notification?.request?.identifier;
      if (!response || handled.current === id) return;
      handled.current = id;
      const data = response.notification.request.content.data || {};
      // An admin notification on a customer login (or the other way round) would open a screen
      // this user cannot see, so only follow a route that fits the account that is logged in.
      const target = routeFor(data, currentUser);
      if (target.startsWith('/admin') === (currentUser.role === 'admin')) router.push(target);
      clearBadge();
    };

    // Tapped while the app was closed: the response is waiting when the app starts.
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});

    const tapped = Notifications.addNotificationResponseReceivedListener(open);

    // Arrived while the app is open: pull in the change behind it, without a spinner or
    // an error toast — the banner is already on screen. Notifications the phone made itself
    // (`data.local`) come from a sync that has just updated the screens.
    const received = Notifications.addNotificationReceivedListener((notification) => {
      if (notification?.request?.content?.data?.local) return;
      actions.refresh({ spinner: false, quiet: true });
    });

    return () => {
      tapped.remove();
      received.remove();
    };
  }, [currentUser, actions]);
}
