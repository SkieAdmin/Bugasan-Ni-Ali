// The logged-in user's own account: /api/me
import { Router } from 'express';
import { z } from 'zod';
import { signToken } from '../middleware/auth.js';
import { forbidden } from '../lib/errors.js';
import { parse, password, phone, requiredText } from '../lib/validate.js';
import { applyForWholesale, changePassword, toUser, updateProfile } from '../services/users.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ user: req.user });
});

const profileSchema = z.object({
  name: requiredText(80, 'Full name').optional(),
  phone: phone.optional(),
  address: requiredText(300, 'Address').optional(),
});

router.patch('/', (req, res) => {
  res.json({ user: updateProfile(req.user.id, parse(profileSchema, req.body)) });
});

const passwordSchema = z.object({
  currentPassword: z.string().max(200),
  newPassword: password,
});

// Returns a new token: tokens issued before the change stop working.
router.post('/password', async (req, res) => {
  const { currentPassword, newPassword } = parse(passwordSchema, req.body);
  const account = await changePassword(req.user.id, currentPassword, newPassword);
  res.json({ token: signToken(account), user: toUser(account) });
});

const wholesaleSchema = z.object({ businessName: requiredText(120, 'Business name') });

router.post('/wholesale-application', (req, res) => {
  if (req.user.role !== 'customer') throw forbidden('Only customer accounts can apply for wholesale.');
  const { businessName } = parse(wholesaleSchema, req.body);
  res.json({ user: applyForWholesale(req.user.id, businessName) });
});

export default router;
