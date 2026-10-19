// Request validation with zod, plus the small schemas the routes share.
import { z } from 'zod';
import { badRequest } from './errors.js';

// zod's own messages ("Invalid input: expected string ...") do not say which field they are about.
const GENERIC_MESSAGE = /^(Invalid|Too (small|big)|Unrecognized)/;

// Parses data with a schema. On failure throws a 400 whose message is the first problem
// (ready to show in the app) and whose `fields` lists every problem by field name.
export function parse(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  const [first] = result.error.issues;
  const where = first.path.length && GENERIC_MESSAGE.test(first.message) ? `${first.path.join('.')}: ` : '';
  throw badRequest(`${where}${first.message}`, fields);
}

export const id = z.string().trim().min(1).max(64);

export const text = (max, label = 'This field') =>
  z.string().trim().max(max, `${label} must be at most ${max} characters.`);

export const requiredText = (max, label = 'This field') =>
  text(max, label).min(1, `${label} is required.`);

export const money = (label = 'Price') =>
  z.number(`${label} must be a number.`).positive(`${label} must be more than 0.`).max(10_000_000);

export const zeroOrMore = (label = 'This value') =>
  z.number(`${label} must be a number.`).min(0, `${label} must be 0 or more.`).max(10_000_000);

// Any date the JavaScript Date parser understands, stored as an ISO string (UTC).
export const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date.')
  .transform((v) => new Date(v).toISOString());

// Same rules as the register screen in the app.
export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .regex(/^\S+@\S+\.\S+$/, 'Enter a valid email address.');

export const phone = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v.replace(/\D/g, '').length >= 10, 'Enter a valid mobile number.');

// bcrypt only uses the first 72 bytes of a password.
export const password = z.string().min(6, 'Password must be at least 6 characters.').max(72, 'Password is too long.');

export const reportDays = z.object({
  days: z.coerce.number().int().min(1).max(366).default(30),
});
