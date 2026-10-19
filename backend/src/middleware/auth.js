// Login tokens (JWT). The app sends them as:  Authorization: Bearer <token>
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { findAccountById, toUser } from '../services/users.js';

// `account` is the raw users row (it has token_version).
export function signToken(account) {
  return jwt.sign({ v: account.token_version }, config.jwtSecret, {
    subject: account.id,
    expiresIn: config.jwtExpiresIn,
    algorithm: 'HS256',
  });
}

// Puts the logged-in user on req.user, or answers 401.
export function requireAuth(req, res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw unauthorized('Your session has expired. Please log in again.');
  }

  // Load the account on every request so a removed account or a changed password
  // takes effect right away.
  const account = findAccountById(payload.sub);
  if (!account || account.token_version !== payload.v) {
    throw unauthorized('Your session has expired. Please log in again.');
  }
  req.user = toUser(account);
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') throw forbidden('Only the store admin can do this.');
  next();
}

export const isAdmin = (req) => req.user?.role === 'admin';
