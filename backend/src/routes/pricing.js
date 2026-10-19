// Discount rules (/api/pricing-rules) and store settings (/api/settings).
import { Router } from 'express';
import { z } from 'zod';
import { isAdmin, requireAdmin } from '../middleware/auth.js';
import { parse, requiredText, text, zeroOrMore } from '../lib/validate.js';
import { createRule, deleteRule, listRules, updateRule } from '../services/pricingRules.js';
import { getSettings, updateSettings } from '../services/settings.js';

// ---------- /api/pricing-rules ----------

export const rulesRouter = Router();

const ruleFields = {
  name: requiredText(60, 'Name'),
  minKg: z.number('Minimum kilos must be a number.').positive('Minimum kilos must be more than 0.').max(1_000_000),
  type: z.enum(['percent', 'perKg']),
  value: z.number('Discount must be a number.').positive('Discount must be more than 0.').max(100_000),
  appliesTo: z.enum(['all', 'retail', 'wholesale']),
  active: z.boolean(),
};

// Customers get the active rules (to show deals); the admin gets all of them.
rulesRouter.get('/', (req, res) => {
  res.json({ rules: listRules({ activeOnly: !isAdmin(req) }) });
});

rulesRouter.post('/', requireAdmin, (req, res) => {
  const schema = z.object({ ...ruleFields, appliesTo: ruleFields.appliesTo.default('all'), active: ruleFields.active.default(true) });
  res.status(201).json({ rule: createRule(parse(schema, req.body)) });
});

rulesRouter.patch('/:id', requireAdmin, (req, res) => {
  res.json({ rule: updateRule(req.params.id, parse(z.object(ruleFields).partial(), req.body)) });
});

rulesRouter.delete('/:id', requireAdmin, (req, res) => {
  deleteRule(req.params.id);
  res.status(204).end();
});

// ---------- /api/settings (admin) ----------

export const settingsRouter = Router();

const settingsSchema = z.object({
  deliveryFee: zeroOrMore('Delivery fee').optional(),
  freeDeliveryMin: zeroOrMore('Free delivery minimum').optional(),
  store: z
    .object({
      name: requiredText(80, 'Store name'),
      tagline: text(120, 'Tagline'),
      address: requiredText(200, 'Store address'),
      phone: text(40, 'Phone'),
      hours: text(80, 'Hours'),
      gcash: text(80, 'GCash'),
      maya: text(80, 'Maya'),
      bank: text(120, 'Bank'),
    })
    .partial()
    .optional(),
  riders: z
    .array(z.object({ name: requiredText(80, 'Rider name'), phone: text(30, 'Rider phone'), vehicle: text(40, 'Vehicle') }))
    .max(30)
    .optional(),
  categories: z.array(requiredText(40, 'Category')).min(1).max(30).optional(),
});

settingsRouter.get('/', requireAdmin, (req, res) => {
  res.json({ settings: getSettings() });
});

settingsRouter.patch('/', requireAdmin, (req, res) => {
  res.json({ settings: updateSettings(parse(settingsSchema, req.body)) });
});
