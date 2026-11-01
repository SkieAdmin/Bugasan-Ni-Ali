// The logged-in user's own account: /api/me
import { Router } from 'express';
import { z } from 'zod';
import { signToken } from '../middleware/auth.js';
import { forbidden } from '../lib/errors.js';
import { parse, password, phone, requiredText, text } from '../lib/validate.js';
import { applyForWholesale, changePassword, toUser, updateProfile } from '../services/users.js';
import { listDevices, registerDevice, sendTestNotification, unregisterDevice } from '../services/push.js';

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

// ---------- Push notifications: /api/me/devices ----------

const deviceSchema = z.object({
  token: requiredText(200, 'Push token'),
  platform: z.enum(['ios', 'android', 'web']).default('android'),
  deviceName: text(80, 'Device name').default(''),
});

router.get('/devices', (req, res) => {
  res.json({ devices: listDevices(req.user.id) });
});

// The app calls this right after logging in, and again whenever Expo gives it a new token.
router.post('/devices', (req, res) => {
  res.status(201).json({ device: registerDevice(req.user.id, parse(deviceSchema, req.body)) });
});

// On logout, so the next person to use this phone does not get the previous user's notifications.
router.delete('/devices/:token', (req, res) => {
  unregisterDevice(req.user.id, req.params.token);
  res.status(204).end();
});

// "Send a test notification" in the app, so the user can check this phone really receives them.
router.post('/devices/test', async (req, res) => {
  const sent = await sendTestNotification(req.user.id);
  res.json({ sent });
});

const wholesaleSchema = z.object({ businessName: requiredText(120, 'Business name') });

router.post('/wholesale-application', (req, res) => {
  if (req.user.role !== 'customer') throw forbidden('Only customer accounts can apply for wholesale.');
  const { businessName } = parse(wholesaleSchema, req.body);
  res.json({ user: applyForWholesale(req.user.id, businessName) });
});

export default router;
