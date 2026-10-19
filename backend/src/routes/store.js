// GET /api/store — public store info the app needs before anyone logs in
// (name, address, hours, payment accounts, rice categories, delivery fees, time slots).
import { Router } from 'express';
import { UNITS } from '../lib/pricing.js';
import { PAYMENT_METHODS, TIME_SLOTS } from '../lib/orders.js';
import { deliverySettings, getSettings } from '../services/settings.js';

const router = Router();

router.get('/', (req, res) => {
  const settings = getSettings();
  res.json({
    store: settings.store,
    categories: settings.categories,
    settings: deliverySettings(settings),
    units: UNITS,
    paymentMethods: PAYMENT_METHODS,
    timeSlots: TIME_SLOTS,
  });
});

export default router;
