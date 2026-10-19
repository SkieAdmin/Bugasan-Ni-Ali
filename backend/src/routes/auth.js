// POST /api/auth/register, POST /api/auth/login
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { signToken } from '../middleware/auth.js';
import { unauthorized } from '../lib/errors.js';
import { email, parse, password, phone, requiredText, text } from '../lib/validate.js';
import { checkPassword, createUser, findAccountByEmail, findAccountById, toUser } from '../services/users.js';

const router = Router();

// Slows down password guessing and sign-up spam: 20 tries per 15 minutes per visitor.
router.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
  })
);

const registerSchema = z
  .object({
    name: requiredText(80, 'Full name'),
    email,
    password,
    phone,
    address: requiredText(300, 'Address'),
    accountType: z.enum(['retail', 'wholesale']).default('retail'),
    businessName: text(120, 'Business name').default(''),
  })
  .refine((f) => f.accountType !== 'wholesale' || f.businessName, {
    message: 'Business name is required.',
    path: ['businessName'],
  });

const loginSchema = z.object({
  email: z.string().trim().max(120),
  password: z.string().max(200),
});

// Compared against when the email does not exist, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

router.post('/register', async (req, res) => {
  const form = parse(registerSchema, req.body);
  const user = await createUser({ ...form, role: 'customer' });
  res.status(201).json({ token: signToken(findAccountById(user.id)), user });
});

router.post('/login', async (req, res) => {
  const { email: givenEmail, password: givenPassword } = parse(loginSchema, req.body);
  const account = findAccountByEmail(givenEmail);
  const ok = await checkPassword(givenPassword, account ? account.password_hash : DUMMY_HASH);
  if (!account || !ok) throw unauthorized('Incorrect email or password.');
  res.json({ token: signToken(account), user: toUser(account) });
});

export default router;
