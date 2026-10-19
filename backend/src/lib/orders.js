// Order statuses, fulfillment flows and payment methods.
// Same values as frontend/src/utils/orders.js (minus the UI icons and colors). Keep the two in sync.

export const ORDER_STATUS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  out_for_delivery: 'Out for Delivery',
  ready_for_pickup: 'Ready for Pickup',
  delivered: 'Delivered',
  picked_up: 'Picked Up',
  cancelled: 'Cancelled',
};

export const DELIVERY_FLOW = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
export const PICKUP_FLOW = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up'];

export function statusFlow(order) {
  return order.fulfillment === 'delivery' ? DELIVERY_FLOW : PICKUP_FLOW;
}

export function nextStatus(order) {
  const flow = statusFlow(order);
  const index = flow.indexOf(order.status);
  if (index === -1 || index === flow.length - 1) return null;
  return flow[index + 1];
}

export function isCompleted(order) {
  return order.status === 'delivered' || order.status === 'picked_up';
}

export function isActive(order) {
  return !isCompleted(order) && order.status !== 'cancelled';
}

export const PAYMENT_METHODS = {
  cash: { label: 'Cash', digital: false },
  gcash: { label: 'GCash', digital: true },
  maya: { label: 'Maya', digital: true },
  bank: { label: 'Bank Transfer', digital: true },
};

export const PAYMENT_STATUS = ['unpaid', 'for_verification', 'paid', 'refunded'];

export const PO_STATUS = ['ordered', 'received', 'cancelled'];

export const TIME_SLOTS = ['8:00 – 10:00 AM', '10:00 AM – 12:00 NN', '1:00 – 3:00 PM', '3:00 – 5:00 PM'];
