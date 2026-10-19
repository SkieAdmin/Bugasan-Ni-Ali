// Rice varieties: /api/products
// Everyone logged in can read the catalog; only the admin can change it.
import { Router } from 'express';
import { z } from 'zod';
import { isAdmin, requireAdmin } from '../middleware/auth.js';
import { notFound } from '../lib/errors.js';
import { addDays } from '../lib/format.js';
import { id, money, parse, requiredText, text, zeroOrMore } from '../lib/validate.js';
import {
  adjustStock,
  createProduct,
  forCustomer,
  getProduct,
  listMovements,
  listProducts,
  soldKgSince,
  updateProduct,
} from '../services/products.js';

const router = Router();

const fields = {
  name: requiredText(80, 'Name'),
  category: requiredText(40, 'Category'),
  origin: requiredText(80, 'Origin'),
  description: text(500, 'Description'),
  retailPrice: money('Retail price'),
  wholesalePrice: money('Wholesale price'),
  costPerKg: money('Cost per kg'),
  reorderLevel: zeroOrMore('Reorder level'),
  supplierId: id.nullable(),
  tint: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Tint must be a color like #B7862B.'),
  active: z.boolean(),
};

const createSchema = z.object({
  ...fields,
  description: fields.description.default(''),
  stockKg: zeroOrMore('Opening stock').default(0),
  supplierId: fields.supplierId.default(null),
  tint: fields.tint.default('#B7862B'),
  active: fields.active.default(true),
});

const updateSchema = z.object(fields).partial();

const adjustSchema = z.object({
  kgChange: z
    .number('Enter the number of kilos.')
    .refine((v) => v !== 0, 'Enter a number other than 0.')
    .refine((v) => Math.abs(v) <= 1_000_000, 'That is too many kilos.'),
  note: text(120, 'Reason').default('Stock adjustment'),
});

router.get('/', (req, res) => {
  const products = isAdmin(req) ? listProducts() : listProducts({ includeInactive: false }).map(forCustomer);
  res.json({ products });
});

router.get('/:id', (req, res) => {
  const product = getProduct(req.params.id);
  if (!product) throw notFound('Rice variety');
  res.json({ product: isAdmin(req) ? product : forCustomer(product) });
});

router.post('/', requireAdmin, (req, res) => {
  res.status(201).json({ product: createProduct(parse(createSchema, req.body)) });
});

router.patch('/:id', requireAdmin, (req, res) => {
  res.json({ product: updateProduct(req.params.id, parse(updateSchema, req.body)) });
});

// Manual stock change, e.g. { "kgChange": -12, "note": "Damaged sack (wet)" }
router.post('/:id/stock-adjustments', requireAdmin, (req, res) => {
  const { kgChange, note } = parse(adjustSchema, req.body);
  res.json({ product: adjustStock(req.params.id, kgChange, note || 'Stock adjustment') });
});

// Stock movement history + kilos sold in the last 30 days (admin variety screen).
router.get('/:id/movements', requireAdmin, (req, res) => {
  const product = getProduct(req.params.id);
  if (!product) throw notFound('Rice variety');
  const since30 = addDays(new Date(), -29);
  since30.setHours(0, 0, 0, 0);
  res.json({
    movements: listMovements({ productId: product.id }),
    soldKg30: soldKgSince(product.id, since30.toISOString()),
  });
});

export default router;
