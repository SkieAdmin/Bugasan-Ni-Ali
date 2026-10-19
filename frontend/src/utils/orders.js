import { colors } from '../theme';

// Every order status the store uses, with how it should look in the UI.
export const ORDER_STATUS = {
  pending: {
    label: 'Pending',
    icon: 'clock-outline',
    tone: 'warning',
    description: 'Waiting for the store to confirm your order.',
  },
  confirmed: {
    label: 'Confirmed',
    icon: 'check-circle-outline',
    tone: 'info',
    description: 'The store has accepted your order.',
  },
  preparing: {
    label: 'Preparing',
    icon: 'package-variant',
    tone: 'info',
    description: 'Your rice is being weighed and packed.',
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    icon: 'truck-delivery-outline',
    tone: 'info',
    description: 'Our rider is on the way to your address.',
  },
  ready_for_pickup: {
    label: 'Ready for Pickup',
    icon: 'storefront-outline',
    tone: 'info',
    description: 'Your order is packed and waiting at the store.',
  },
  delivered: {
    label: 'Delivered',
    icon: 'check-decagram',
    tone: 'success',
    description: 'Order delivered. Salamat po!',
  },
  picked_up: {
    label: 'Picked Up',
    icon: 'check-decagram',
    tone: 'success',
    description: 'Order picked up. Salamat po!',
  },
  cancelled: {
    label: 'Cancelled',
    icon: 'close-circle-outline',
    tone: 'danger',
    description: 'This order was cancelled. Stock was returned to inventory.',
  },
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
  cash: { label: 'Cash', icon: 'cash', digital: false, hint: 'Pay when you receive or pick up your order' },
  gcash: { label: 'GCash', icon: 'cellphone', digital: true, hint: 'Send to the store GCash number' },
  maya: { label: 'Maya', icon: 'wallet-outline', digital: true, hint: 'Send to the store Maya number' },
  bank: { label: 'Bank Transfer', icon: 'bank-outline', digital: true, hint: 'Deposit to the store bank account' },
};

export const PAYMENT_STATUS = {
  unpaid: { label: 'Unpaid', tone: 'warning' },
  for_verification: { label: 'For Verification', tone: 'info' },
  paid: { label: 'Paid', tone: 'success' },
  refunded: { label: 'Refunded', tone: 'neutral' },
};

export const PO_STATUS = {
  ordered: { label: 'Awaiting delivery', tone: 'info', icon: 'truck-outline' },
  received: { label: 'Received', tone: 'success', icon: 'check' },
  cancelled: { label: 'Cancelled', tone: 'danger', icon: 'close' },
};

export const TIME_SLOTS = ['8:00 – 10:00 AM', '10:00 AM – 12:00 NN', '1:00 – 3:00 PM', '3:00 – 5:00 PM'];

export function toneColors(tone) {
  switch (tone) {
    case 'success':
      return { bg: colors.successLight, fg: colors.success };
    case 'warning':
      return { bg: colors.warningLight, fg: colors.warning };
    case 'danger':
      return { bg: colors.dangerLight, fg: colors.danger };
    case 'info':
      return { bg: colors.infoLight, fg: colors.info };
    case 'primary':
      return { bg: colors.primaryLight, fg: colors.primary };
    case 'accent':
      return { bg: colors.accentLight, fg: colors.warning };
    default:
      return { bg: colors.divider, fg: colors.textSecondary };
  }
}

export function itemsSummary(order) {
  const first = order.items[0];
  if (!first) return '';
  const more = order.items.length - 1;
  return `${first.name}${more > 0 ? ` + ${more} more` : ''}`;
}
