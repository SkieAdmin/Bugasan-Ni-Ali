// Notifications the phone makes on its own, from the data the app already syncs.
//
// Real push (backend -> Expo -> Firebase -> phone) only works in a build that has a Firebase
// project and an EAS project id (see frontend/README.md, "Push notifications"). Until then the
// app does the same job itself: every time it syncs it compares what it just got with what it
// saw last time, and shows a notification for each change the backend would have pushed — the
// same title, the same text and the same screen when tapped (backend/src/lib/notifications.js).
//
// It runs while the app is open (every few seconds, see AppContext) and from a background task
// while it is closed (src/notifications/backgroundCheck.js; Android decides when, at most every
// 15 minutes).
//
// What was seen last is stored per account, so each change is announced exactly once, whether
// the open app or the background task finds it first.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { loadPushMode, showLocalNotification } from '../api/push';
import { peso } from '../utils/format';
import { ORDER_STATUS } from '../utils/orders';

const seenKey = (userId) => `bugasan-ni-ali.seen.${userId}`;

// Orders remembered per account. Old ones drop off; they no longer change anyway.
const MAX_ORDERS = 1000;

// More updates than this at once (the phone was off for a day) become one summary notification.
const MAX_SEPARATE = 4;

// Only the newest orders are fetched when looking for updates: new orders and status changes
// are always among them.
const RECENT_ORDERS = 30;

// ---------- The notification texts (same as backend/src/lib/notifications.js) ----------

const customerScreen = (orderId) => ({ screen: 'order', orderId });
const adminScreen = (orderId) => ({ screen: 'admin-order', orderId });

const STATUS_MESSAGE = {
  confirmed: (order) => `Order ${order.id} is confirmed. We are getting your rice ready.`,
  preparing: (order) => `We are packing the rice for order ${order.id}.`,
  out_for_delivery: (order) =>
    order.rider?.name ? `${order.rider.name} is on the way with order ${order.id}.` : `Order ${order.id} is on the way to you.`,
  ready_for_pickup: (order) => `Order ${order.id} is ready for pickup at the store.`,
  delivered: (order) => `Order ${order.id} was delivered. Salamat sa imong pagpalit!`,
  picked_up: (order) => `Order ${order.id} was picked up. Salamat sa imong pagpalit!`,
};

const message = {
  orderStatusChanged: (order) =>
    STATUS_MESSAGE[order.status] && {
      title: ORDER_STATUS[order.status]?.label || 'Order update',
      body: STATUS_MESSAGE[order.status](order),
      data: customerScreen(order.id),
    },
  orderCancelledByStore: (order) => ({
    title: 'Order cancelled',
    body: `The store cancelled order ${order.id}.`,
    data: customerScreen(order.id),
  }),
  paymentVerified: (order) => ({
    title: 'Payment received',
    body: `We confirmed your ${peso(order.total)} payment for order ${order.id}.`,
    data: customerScreen(order.id),
  }),
  wholesaleApproved: (user) => ({
    title: 'Wholesale approved',
    body: `${user.businessName} is approved. You now get wholesale prices on every order.`,
    data: { screen: 'profile' },
  }),
  wholesaleDeclined: () => ({
    title: 'Wholesale application',
    body: 'Your wholesale application was not approved. You can still order at retail prices.',
    data: { screen: 'profile' },
  }),
  newOrder: (order) => {
    const how = order.fulfillment === 'delivery' ? 'Delivery' : 'Pickup';
    const count = order.items?.length || 0;
    return {
      title: `New order · ${peso(order.total)}`,
      body: `${order.customerName} ordered ${count} item${count === 1 ? '' : 's'} (${how}). ${order.id}`,
      data: adminScreen(order.id),
    };
  },
  orderCancelledByCustomer: (order) => ({
    title: 'Order cancelled',
    body: `${order.customerName} cancelled order ${order.id}. The rice went back to inventory.`,
    data: adminScreen(order.id),
  }),
  wholesaleApplication: (user) => ({
    title: 'New wholesale application',
    body: `${user.businessName} (${user.name}) is applying for wholesale prices.`,
    data: { screen: 'wholesale' },
  }),
  lowStock: (product) => ({
    title: 'Low stock',
    body: `${product.name} is down to ${product.stockKg} kg (reorder level ${product.reorderLevel} kg).`,
    data: { screen: 'inventory', productId: product.id },
  }),
};

// ---------- What the phone saw last ----------

const isLow = (p) => p.active !== false && p.reorderLevel > 0 && p.stockKg <= p.reorderLevel;
const isApplicant = (u) => u.wholesaleStatus === 'pending';

async function loadSeen(userId) {
  try {
    const raw = await AsyncStorage.getItem(seenKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveSeen(userId, seen) {
  try {
    await AsyncStorage.setItem(seenKey(userId), JSON.stringify(seen));
  } catch {
    // Storage full: the worst case is a notification shown twice.
  }
}

// Ids in `items` that pass `test`. A complete list replaces the previous ids; a partial one
// (a single item the user just changed) only updates the items it contains.
function idsFrom(previous = [], items, test, partial) {
  const passing = items.filter(test).map((x) => x.id);
  if (!partial) return passing;
  const touched = new Set(items.map((x) => x.id));
  return [...previous.filter((id) => !touched.has(id)), ...passing];
}

function record(before, data, { partial = false } = {}) {
  const seen = { orders: {}, newest: '', ...before };

  const orders = { ...seen.orders };
  let newest = seen.newest || '';
  for (const order of data.orders || []) {
    orders[order.id] = { s: order.status, p: order.paymentStatus };
    if (order.createdAt > newest) newest = order.createdAt;
  }
  seen.orders = Object.fromEntries(Object.entries(orders).slice(-MAX_ORDERS));
  seen.newest = newest;

  if (data.me) seen.wholesale = data.me.wholesaleStatus ?? null;
  if (data.users) seen.applicants = idsFrom(seen.applicants, data.users, isApplicant, partial);
  if (data.products) seen.low = idsFrom(seen.low, data.products, isLow, partial);
  return seen;
}

// Every change between `seen` and `data` that is worth a notification for this account.
function findUpdates(seen, data, user) {
  const updates = [];
  const admin = user.role === 'admin';

  for (const order of data.orders || []) {
    const before = seen.orders?.[order.id];
    if (admin) {
      // Newer than anything seen so far, so it was placed since the last check.
      if (!before && order.status === 'pending' && order.createdAt > (seen.newest || '')) updates.push(message.newOrder(order));
      // Customers can only cancel pending orders; the store's own cancellations need no alert.
      else if (before && before.s === 'pending' && order.status === 'cancelled') updates.push(message.orderCancelledByCustomer(order));
      continue;
    }

    if (!before) continue;
    if (order.status !== before.s) {
      updates.push(order.status === 'cancelled' ? message.orderCancelledByStore(order) : message.orderStatusChanged(order));
    }
    if (order.paymentStatus === 'paid' && before.p !== 'paid' && order.status !== 'cancelled') {
      updates.push(message.paymentVerified(order));
    }
  }

  if (!admin && data.me && seen.wholesale === 'pending') {
    if (data.me.wholesaleStatus === 'approved') updates.push(message.wholesaleApproved(data.me));
    else if (!data.me.wholesaleStatus) updates.push(message.wholesaleDeclined());
  }

  if (admin && data.users && Array.isArray(seen.applicants)) {
    data.users.filter((u) => isApplicant(u) && !seen.applicants.includes(u.id)).forEach((u) => updates.push(message.wholesaleApplication(u)));
  }

  if (admin && data.products && Array.isArray(seen.low)) {
    data.products.filter((p) => isLow(p) && !seen.low.includes(p.id)).forEach((p) => updates.push(message.lowStock(p)));
  }

  return updates.filter(Boolean);
}

async function announce(updates, user) {
  const list =
    updates.length > MAX_SEPARATE
      ? [
          {
            title: 'Bugasan ni Ali',
            body: `You have ${updates.length} new updates. Open the app to see them.`,
            data: user.role === 'admin' ? { screen: 'admin-order' } : { screen: 'order' },
          },
        ]
      : updates;
  for (const update of list) {
    try {
      await showLocalNotification(update);
    } catch (err) {
      console.warn('[alerts] could not show a notification:', err?.message);
    }
  }
}

// The open app and the background task can both be checking at the same moment; one at a time,
// or both would announce the same change.
let queue = Promise.resolve();
const oneAtATime = (work) => {
  const run = queue.then(work, work);
  queue = run.catch(() => {});
  return run;
};

// ---------- What the rest of the app calls ----------

// The part of the app's data that can produce a notification for this account.
export function updatesFrom(user, data) {
  if (user?.role === 'admin') return { orders: data.orders, users: data.users, products: data.products };
  return { orders: data.orders, me: data.currentUser };
}

// The few small requests needed to look for updates (cheaper than a full refresh).
export async function fetchUpdates(user) {
  const limit = `/orders?limit=${RECENT_ORDERS}`;
  if (user.role === 'admin') {
    const [orders, customers, products] = await Promise.all([
      api.get(limit),
      api.get('/customers?wholesaleStatus=pending'),
      api.get('/products'),
    ]);
    return { orders: orders.orders, users: customers.customers, products: products.products };
  }
  const [orders, me] = await Promise.all([api.get(limit), api.get('/me')]);
  return { orders: orders.orders, me: me.user };
}

// Compares fresh data with what this phone saw last, shows a notification for every change
// (when the phone makes its own notifications) and remembers the new state.
// `quiet` only remembers: right after login, or when the backend's push already covers it.
// Resolves to the updates found.
export function checkForUpdates(user, data, { quiet = false } = {}) {
  return oneAtATime(async () => {
    if (!user?.id || !data) return [];
    const seen = await loadSeen(user.id);
    // The first check on this phone only takes note of how things are.
    const updates = seen ? findUpdates(seen, data, user) : [];
    await saveSeen(user.id, record(seen, data));
    if (updates.length && !quiet && (await loadPushMode()) === 'local') await announce(updates, user);
    return updates;
  });
}

// Something the user just changed on this phone (cancelled an order, approved a reseller):
// it is already on their screen, so it must not come back as a notification.
export function noteSeen(user, data) {
  return oneAtATime(async () => {
    if (!user?.id) return;
    const seen = await loadSeen(user.id);
    if (seen) await saveSeen(user.id, record(seen, data, { partial: true }));
  });
}
