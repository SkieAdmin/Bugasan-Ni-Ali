// The text of every push notification the store sends, in one place.
//
// Each builder returns { title, body, data } — or null when that event is not worth a
// notification. `data` is what the app reads when the customer taps the notification:
// `screen` is the route to open (see frontend/src/api/push.js).

import { peso } from './format.js';
import { ORDER_STATUS } from './orders.js';

const customerScreen = (orderId) => ({ screen: 'order', orderId });
const adminScreen = (orderId) => ({ screen: 'admin-order', orderId });

// What the customer sees for each step of their order. Statuses that are only interesting
// to the store (e.g. "preparing" on a pickup order is still useful) all have a line here;
// anything missing is simply not sent.
const STATUS_MESSAGE = {
  confirmed: (order) => `Order ${order.id} is confirmed. We are getting your rice ready.`,
  preparing: (order) => `We are packing the rice for order ${order.id}.`,
  out_for_delivery: (order) =>
    order.rider?.name
      ? `${order.rider.name} is on the way with order ${order.id}.`
      : `Order ${order.id} is on the way to you.`,
  ready_for_pickup: (order) => `Order ${order.id} is ready for pickup at the store.`,
  delivered: (order) => `Order ${order.id} was delivered. Salamat sa imong pagpalit!`,
  picked_up: (order) => `Order ${order.id} was picked up. Salamat sa imong pagpalit!`,
};

// ---------- To the customer ----------

export function orderStatusChanged(order) {
  const line = STATUS_MESSAGE[order.status];
  if (!line) return null;
  return {
    title: ORDER_STATUS[order.status],
    body: line(order),
    data: customerScreen(order.id),
  };
}

export function orderCancelledByStore(order, reason) {
  return {
    title: 'Order cancelled',
    body: `The store cancelled order ${order.id}${reason ? `: ${reason}` : '.'}`,
    data: customerScreen(order.id),
  };
}

export function paymentVerified(order) {
  return {
    title: 'Payment received',
    body: `We confirmed your ${peso(order.total)} payment for order ${order.id}.`,
    data: customerScreen(order.id),
  };
}

export function wholesaleApproved(user) {
  return {
    title: 'Wholesale approved',
    body: `${user.businessName} is approved. You now get wholesale prices on every order.`,
    data: { screen: 'profile' },
  };
}

export function wholesaleDeclined() {
  return {
    title: 'Wholesale application',
    body: 'Your wholesale application was not approved. You can still order at retail prices.',
    data: { screen: 'profile' },
  };
}

// ---------- To the store admin ----------

export function newOrder(order) {
  const how = order.fulfillment === 'delivery' ? 'Delivery' : 'Pickup';
  return {
    title: `New order · ${peso(order.total)}`,
    body: `${order.customerName} ordered ${order.items.length} item${order.items.length === 1 ? '' : 's'} (${how}). ${order.id}`,
    data: adminScreen(order.id),
  };
}

export function orderCancelledByCustomer(order) {
  return {
    title: 'Order cancelled',
    body: `${order.customerName} cancelled order ${order.id}. The rice went back to inventory.`,
    data: adminScreen(order.id),
  };
}

export function wholesaleApplication(user) {
  return {
    title: 'New wholesale application',
    body: `${user.businessName} (${user.name}) is applying for wholesale prices.`,
    data: { screen: 'wholesale' },
  };
}

export function lowStock(product) {
  return {
    title: 'Low stock',
    body: `${product.name} is down to ${product.stockKg} kg (reorder level ${product.reorderLevel} kg).`,
    data: { screen: 'inventory', productId: product.id },
  };
}
