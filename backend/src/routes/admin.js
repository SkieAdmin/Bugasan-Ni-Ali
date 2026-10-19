// Admin-only resources: suppliers, purchase orders, customers and reports.
// app.js mounts these behind requireAuth + requireAdmin.
import { Router } from 'express';
import { z } from 'zod';
import { id, isoDate, money, parse, reportDays, requiredText, text } from '../lib/validate.js';
import { PO_STATUS } from '../lib/orders.js';
import { notFound } from '../lib/errors.js';
import { createSupplier, listSuppliers, requireSupplier, updateSupplier } from '../services/suppliers.js';
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  listPurchaseOrders,
  receivePurchaseOrder,
  requirePurchaseOrder,
} from '../services/purchaseOrders.js';
import { getCustomer, listCustomers, setWholesaleStatus } from '../services/users.js';
import { listOrders } from '../services/orders.js';
import * as reports from '../services/reports.js';

// ---------- /api/suppliers ----------

export const suppliersRouter = Router();

const supplierFields = {
  name: requiredText(100, 'Supplier name'),
  contactPerson: text(100, 'Contact person'),
  phone: text(30, 'Phone'),
  email: z.union([z.literal(''), z.string().trim().toLowerCase().max(120).regex(/^\S+@\S+\.\S+$/, 'Enter a valid email address.')]),
  address: text(200, 'Address'),
  leadTimeDays: z.number().int('Lead time must be whole days.').min(0).max(365),
  varietyIds: z.array(id).max(200),
};

suppliersRouter.get('/', (req, res) => {
  res.json({ suppliers: listSuppliers() });
});

suppliersRouter.get('/:id', (req, res) => {
  res.json({ supplier: requireSupplier(req.params.id) });
});

suppliersRouter.post('/', (req, res) => {
  const schema = z.object(supplierFields).partial().required({ name: true });
  res.status(201).json({ supplier: createSupplier(parse(schema, req.body)) });
});

suppliersRouter.patch('/:id', (req, res) => {
  res.json({ supplier: updateSupplier(req.params.id, parse(z.object(supplierFields).partial(), req.body)) });
});

// ---------- /api/purchase-orders ----------

export const purchaseOrdersRouter = Router();

const poSchema = z.object({
  supplierId: id,
  items: z
    .array(
      z.object({
        productId: id,
        sacks: z.number().int('Sacks must be a whole number.').min(1).max(100_000),
        costPerKg: money('Cost per kg'),
      })
    )
    .min(1, 'Add at least one rice variety.')
    .max(50),
  expectedAt: isoDate.nullable().default(null),
  notes: text(300, 'Notes').default(''),
});

purchaseOrdersRouter.get('/', (req, res) => {
  const query = parse(z.object({ supplierId: id.optional(), status: z.enum(PO_STATUS).optional() }), req.query);
  res.json({ purchaseOrders: listPurchaseOrders(query) });
});

purchaseOrdersRouter.get('/:id', (req, res) => {
  res.json({ purchaseOrder: requirePurchaseOrder(req.params.id) });
});

purchaseOrdersRouter.post('/', (req, res) => {
  res.status(201).json({ purchaseOrder: createPurchaseOrder(parse(poSchema, req.body)) });
});

// The delivery arrived: stock goes up.
purchaseOrdersRouter.post('/:id/receive', (req, res) => {
  res.json({ purchaseOrder: receivePurchaseOrder(req.params.id) });
});

purchaseOrdersRouter.post('/:id/cancel', (req, res) => {
  res.json({ purchaseOrder: cancelPurchaseOrder(req.params.id) });
});

// ---------- /api/customers ----------

export const customersRouter = Router();

customersRouter.get('/', (req, res) => {
  const query = parse(z.object({ wholesaleStatus: z.enum(['pending', 'approved']).optional() }), req.query);
  res.json({ customers: listCustomers(query) });
});

customersRouter.get('/:id', (req, res) => {
  const customer = getCustomer(req.params.id);
  res.json({ customer, orders: listOrders({ customerId: customer.id }) });
});

// { "wholesaleStatus": "approved" } approves; { "wholesaleStatus": null } declines or removes access.
customersRouter.patch('/:id', (req, res) => {
  const { wholesaleStatus } = parse(z.object({ wholesaleStatus: z.enum(['approved']).nullable() }), req.body);
  res.json({ customer: setWholesaleStatus(req.params.id, wholesaleStatus) });
});

// ---------- /api/reports ----------

export const reportsRouter = Router();

const REPORTS = {
  sales: reports.salesReport,
  inventory: reports.inventoryReport,
  'best-sellers': reports.bestSellersReport,
  channels: reports.channelReport,
  'supplier-purchases': reports.supplierReport,
};

reportsRouter.get('/dashboard', (req, res) => {
  res.json(reports.dashboard());
});

// Plain-text report for sharing, e.g. GET /api/reports/share?days=30
reportsRouter.get('/share', (req, res) => {
  const { days } = parse(reportDays, req.query);
  res.json({ text: reports.shareText(days) });
});

// GET /api/reports/sales?days=30 (also inventory, best-sellers, channels, supplier-purchases)
reportsRouter.get('/:name', (req, res) => {
  const report = REPORTS[req.params.name];
  if (!report) throw notFound('Report');
  const { days } = parse(reportDays, req.query);
  res.json(report(days));
});
