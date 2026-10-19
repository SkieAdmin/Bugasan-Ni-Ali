// Customer orders: pricing, placing (with automatic stock deduction), status updates,
// payments, riders and cancellation (stock is returned).
import { db, groupBy, transaction, updateRow } from '../db/index.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { nowIso } from '../lib/ids.js';
import { computeCart } from '../lib/pricing.js';
import { ORDER_STATUS, PAYMENT_METHODS, isActive, nextStatus } from '../lib/orders.js';
import { addMovement, changeStock, getProduct } from './products.js';
import { listRules } from './pricingRules.js';
import { deliverySettings, getSettings } from './settings.js';

function toItem(row) {
  return {
    productId: row.product_id,
    name: row.name,
    unit: row.unit,
    qty: row.qty,
    kg: row.kg,
    pricePerKg: row.price_per_kg,
    priceType: row.price_type,
    subtotal: row.subtotal,
    discount: row.discount,
    ruleName: row.rule_name,
    total: row.total,
  };
}

// Same shape as an order in the app's state.
function toOrder(row, itemRows) {
  return {
    id: row.id,
    receiptNo: row.receipt_no,
    customerId: row.customer_id,
    customerName: row.customer_name,
    contactName: row.contact_name,
    customerPhone: row.customer_phone,
    channel: row.channel,
    items: itemRows.map(toItem),
    subtotal: row.subtotal,
    discount: row.discount,
    deliveryFee: row.delivery_fee,
    total: row.total,
    totalKg: row.total_kg,
    fulfillment: row.fulfillment,
    address: row.address,
    schedule: { date: row.schedule_date, slot: row.schedule_slot },
    paymentMethod: row.payment_method,
    paymentRef: row.payment_ref,
    paymentStatus: row.payment_status,
    status: row.status,
    statusHistory: JSON.parse(row.status_history),
    rider: row.rider ? JSON.parse(row.rider) : null,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

// Loads orders (newest first) with their items. `where` is an SQL condition on the orders table.
function loadOrders(where = '1 = 1', params = {}, { limit = -1, offset = 0 } = {}) {
  const rows = db
    .prepare(`SELECT * FROM orders WHERE ${where} ORDER BY created_at DESC, order_no DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset });
  if (!rows.length) return [];
  const items = db
    .prepare('SELECT * FROM order_items WHERE order_id IN (SELECT value FROM json_each(?)) ORDER BY id')
    .all(JSON.stringify(rows.map((r) => r.id)));
  const byOrder = groupBy(items, 'order_id');
  return rows.map((row) => toOrder(row, byOrder.get(row.id) || []));
}

export function listOrders({ customerId, status, since, limit, offset } = {}) {
  const where = ['1 = 1'];
  if (customerId) where.push('customer_id = @customerId');
  if (status) where.push('status = @status');
  if (since) where.push('created_at >= @since');
  return loadOrders(where.join(' AND '), { customerId, status, since }, { limit, offset });
}

export function getOrder(id) {
  return loadOrders('id = @id', { id })[0] || null;
}

export function requireOrder(id) {
  const order = getOrder(id);
  if (!order) throw notFound('Order');
  return order;
}

const ORDER_COLUMNS = {
  status: 'status',
  paymentStatus: 'payment_status',
  statusHistory: 'status_history',
  rider: 'rider',
};

function saveOrder(id, changes) {
  const json = { ...changes };
  if (changes.statusHistory) json.statusHistory = JSON.stringify(changes.statusHistory);
  if (changes.rider !== undefined) json.rider = changes.rider ? JSON.stringify(changes.rider) : null;
  updateRow('orders', ORDER_COLUMNS, id, json);
}

// Kilos per variety in a list of lines: Map(productId -> kg).
function kgByProduct(lines) {
  const map = new Map();
  lines.forEach((l) => map.set(l.productId, (map.get(l.productId) || 0) + l.kg));
  return map;
}

// ---------- Pricing ----------

// Prices a cart for this customer with the current prices, discount rules and delivery fee,
// and checks that there is enough stock. Throws a 409 with a friendly message if not.
function priceCart(user, items, fulfillment) {
  const products = items.map((item) => {
    const product = getProduct(item.productId);
    if (!product || !product.active) {
      throw conflict(`${product ? product.name : 'A rice variety in your cart'} is no longer available.`);
    }
    return product;
  });

  const totals = computeCart(items, products, user, listRules(), deliverySettings(), fulfillment);

  for (const [productId, kg] of kgByProduct(totals.lines)) {
    const product = products.find((p) => p.id === productId);
    if (kg > product.stockKg) throw conflict(`Not enough stock for ${product.name}. Only ${product.stockKg} kg left.`);
  }
  return totals;
}

const lineForResponse = (l) => ({
  productId: l.productId,
  name: l.product.name,
  unit: l.unit,
  qty: l.qty,
  kg: l.kg,
  pricePerKg: l.pricePerKg,
  priceType: l.priceType,
  subtotal: l.subtotal,
  discount: l.discount,
  ruleName: l.ruleName,
  total: l.total,
});

// What the checkout screen shows before placing the order.
export function quoteOrder(user, { items, fulfillment }) {
  const totals = priceCart(user, items, fulfillment);
  return {
    channel: totals.channel,
    items: totals.lines.map(lineForResponse),
    subtotal: totals.subtotal,
    discount: totals.discount,
    deliveryFee: totals.deliveryFee,
    total: totals.total,
    totalKg: totals.totalKg,
  };
}

// ---------- Placing an order ----------

export function placeOrder(user, input) {
  return transaction(() => {
    const totals = priceCart(user, input.items, input.fulfillment);
    const { store } = getSettings();
    const orderNo = db.prepare('SELECT COALESCE(MAX(order_no), 10000) + 1 FROM orders').pluck().get();
    const createdAt = nowIso();
    const digital = PAYMENT_METHODS[input.paymentMethod].digital;

    const order = {
      id: `BNA-${orderNo}`,
      orderNo,
      receiptNo: `OR-${String(orderNo).padStart(6, '0')}`,
      customerId: user.id,
      customerName: user.businessName || user.name,
      contactName: user.name,
      customerPhone: user.phone,
      channel: totals.channel,
      subtotal: totals.subtotal,
      discount: totals.discount,
      deliveryFee: totals.deliveryFee,
      total: totals.total,
      totalKg: totals.totalKg,
      fulfillment: input.fulfillment,
      address: input.fulfillment === 'delivery' ? input.address : store.address,
      scheduleDate: input.schedule.date,
      scheduleSlot: input.schedule.slot,
      paymentMethod: input.paymentMethod,
      paymentRef: digital ? input.paymentRef : '',
      paymentStatus: digital ? 'for_verification' : 'unpaid',
      status: 'pending',
      statusHistory: JSON.stringify([{ status: 'pending', at: createdAt }]),
      notes: input.notes,
      createdAt,
    };

    db.prepare(
      `INSERT INTO orders (id, order_no, receipt_no, customer_id, customer_name, contact_name, customer_phone, channel,
                           subtotal, discount, delivery_fee, total, total_kg, fulfillment, address, schedule_date,
                           schedule_slot, payment_method, payment_ref, payment_status, status, status_history, notes, created_at)
       VALUES (@id, @orderNo, @receiptNo, @customerId, @customerName, @contactName, @customerPhone, @channel,
               @subtotal, @discount, @deliveryFee, @total, @totalKg, @fulfillment, @address, @scheduleDate,
               @scheduleSlot, @paymentMethod, @paymentRef, @paymentStatus, @status, @statusHistory, @notes, @createdAt)`
    ).run(order);

    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, name, unit, qty, kg, price_per_kg, price_type, subtotal, discount, rule_name, total)
       VALUES (@orderId, @productId, @name, @unit, @qty, @kg, @pricePerKg, @priceType, @subtotal, @discount, @ruleName, @total)`
    );
    totals.lines.forEach((line) => insertItem.run({ orderId: order.id, ...lineForResponse(line) }));

    // Automatic stock deduction after the sale.
    for (const [productId, kg] of kgByProduct(totals.lines)) {
      changeStock(productId, -kg);
      addMovement({ productId, type: 'sale', kg: -kg, ref: order.id, note: order.customerName, at: createdAt });
    }

    return requireOrder(order.id);
  });
}

// ---------- Updating an order ----------

// Customers may cancel while the order is still pending. The store may cancel any active
// order that has not left with the rider yet. The rice goes back to inventory.
export function cancelOrder(id, { byStore, reason }) {
  return transaction(() => {
    const order = requireOrder(id);
    if (byStore ? !isActive(order) || order.status === 'out_for_delivery' : order.status !== 'pending') {
      throw conflict(
        byStore
          ? `Order ${id} is ${ORDER_STATUS[order.status]} and can no longer be cancelled.`
          : 'Only pending orders can be cancelled. Please contact the store.'
      );
    }

    const at = nowIso();
    for (const [productId, kg] of kgByProduct(order.items)) {
      changeStock(productId, kg);
      addMovement({ productId, type: 'return', kg, ref: order.id, note: reason, at });
    }
    saveOrder(id, {
      status: 'cancelled',
      paymentStatus: order.paymentStatus === 'paid' ? 'refunded' : order.paymentStatus,
      statusHistory: [...order.statusHistory, { status: 'cancelled', at }],
    });
    return requireOrder(id);
  });
}

// Moves the order to its next step: Pending → Confirmed → Preparing →
// Out for Delivery / Ready for Pickup → Delivered / Picked Up.
export function advanceOrder(id) {
  return transaction(() => {
    const order = requireOrder(id);
    const status = nextStatus(order);
    if (!status) throw conflict(`Order ${id} is already ${ORDER_STATUS[order.status]}.`);

    const done = status === 'delivered' || status === 'picked_up';
    const { riders } = getSettings();
    saveOrder(id, {
      status,
      statusHistory: [...order.statusHistory, { status, at: nowIso() }],
      rider: status === 'out_for_delivery' ? order.rider || riders[0] || null : undefined,
      // Cash is collected on delivery / pickup.
      paymentStatus: done && order.paymentMethod === 'cash' ? 'paid' : undefined,
    });
    return requireOrder(id);
  });
}

export function setRider(id, rider) {
  const order = requireOrder(id);
  if (order.fulfillment !== 'delivery') throw badRequest('Only delivery orders have a rider.');
  if (!isActive(order)) throw conflict(`Order ${id} is already ${ORDER_STATUS[order.status]}.`);
  saveOrder(id, { rider });
  return requireOrder(id);
}

// Verifies a digital payment or records a cash payment.
export function markPaid(id) {
  const order = requireOrder(id);
  if (order.status === 'cancelled') throw conflict(`Order ${id} was cancelled.`);
  if (order.paymentStatus !== 'paid') saveOrder(id, { paymentStatus: 'paid' });
  return requireOrder(id);
}
