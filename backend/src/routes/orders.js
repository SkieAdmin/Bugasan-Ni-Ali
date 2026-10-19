// Orders: /api/orders
// Customers see and place their own orders; the admin sees all orders and moves them along.
import { Router } from 'express';
import { z } from 'zod';
import { isAdmin, requireAdmin } from '../middleware/auth.js';
import { forbidden, notFound } from '../lib/errors.js';
import { addDays, startOfDay } from '../lib/format.js';
import { UNITS } from '../lib/pricing.js';
import { ORDER_STATUS, PAYMENT_METHODS, TIME_SLOTS } from '../lib/orders.js';
import { id, isoDate, parse, requiredText, text } from '../lib/validate.js';
import { advanceOrder, cancelOrder, getOrder, listOrders, markPaid, placeOrder, quoteOrder, setRider } from '../services/orders.js';

const router = Router();

const cartSchema = z.object({
  items: z
    .array(
      z.object({
        productId: id,
        unit: z.enum(Object.keys(UNITS)),
        qty: z.number().int('Quantity must be a whole number.').min(1).max(10_000),
      })
    )
    .min(1, 'Your cart is empty.')
    .max(50),
  fulfillment: z.enum(['delivery', 'pickup']),
});

const scheduleDate = isoDate.refine((v) => {
  const date = new Date(v);
  // From yesterday (phones in other time zones) up to a month ahead.
  return date >= addDays(startOfDay(new Date()), -1) && date <= addDays(new Date(), 31);
}, 'Choose a date within the next month.');

const orderSchema = cartSchema
  .extend({
    address: text(300, 'Address').default(''),
    schedule: z.object({ date: scheduleDate, slot: z.enum(TIME_SLOTS, 'Choose a time slot.') }),
    paymentMethod: z.enum(Object.keys(PAYMENT_METHODS)),
    paymentRef: text(60, 'Reference number').default(''),
    notes: text(500, 'Notes').default(''),
  })
  .refine((o) => o.fulfillment !== 'delivery' || o.address, {
    message: 'Address is needed for deliveries.',
    path: ['address'],
  })
  .refine((o) => !PAYMENT_METHODS[o.paymentMethod].digital || o.paymentRef, {
    message: 'Enter the reference number of your payment.',
    path: ['paymentRef'],
  });

const listSchema = z.object({
  status: z.enum(Object.keys(ORDER_STATUS)).optional(),
  customerId: id.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

const riderSchema = z.object({
  rider: z.object({
    name: requiredText(80, 'Rider name'),
    phone: text(30, 'Rider phone').default(''),
    vehicle: text(40, 'Vehicle').default(''),
  }),
});

const cancelSchema = z.object({ reason: text(120, 'Reason').optional() });

// Customers only ever see their own orders. Someone else's order is "not found", not "forbidden",
// so order numbers cannot be probed.
function findVisibleOrder(req) {
  const order = getOrder(req.params.id);
  if (!order || (!isAdmin(req) && order.customerId !== req.user.id)) throw notFound('Order');
  return order;
}

router.get('/', (req, res) => {
  const query = parse(listSchema, req.query);
  if (!isAdmin(req)) query.customerId = req.user.id;
  res.json({ orders: listOrders(query) });
});

// Prices a cart the same way placing it would (checkout preview). Nothing is saved.
router.post('/quote', (req, res) => {
  res.json({ quote: quoteOrder(req.user, parse(cartSchema, req.body)) });
});

router.post('/', (req, res) => {
  if (req.user.role !== 'customer') throw forbidden('Log in with a customer account to place orders.');
  res.status(201).json({ order: placeOrder(req.user, parse(orderSchema, req.body)) });
});

router.get('/:id', (req, res) => {
  res.json({ order: findVisibleOrder(req) });
});

router.post('/:id/cancel', (req, res) => {
  const order = findVisibleOrder(req);
  const byStore = isAdmin(req);
  const { reason } = parse(cancelSchema, req.body);
  const fallback = byStore ? 'Cancelled by store' : 'Cancelled by customer';
  res.json({ order: cancelOrder(order.id, { byStore, reason: reason || fallback }) });
});

router.post('/:id/advance', requireAdmin, (req, res) => {
  res.json({ order: advanceOrder(req.params.id) });
});

router.put('/:id/rider', requireAdmin, (req, res) => {
  res.json({ order: setRider(req.params.id, parse(riderSchema, req.body).rider) });
});

router.post('/:id/mark-paid', requireAdmin, (req, res) => {
  res.json({ order: markPaid(req.params.id) });
});

export default router;
