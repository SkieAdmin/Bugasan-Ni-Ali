// Customer and admin accounts.
import bcrypt from 'bcryptjs';
import { db, updateRow } from '../db/index.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { newId, nowIso } from '../lib/ids.js';

const BCRYPT_ROUNDS = 10;

// Never includes the password hash.
export function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    accountType: row.account_type,
    wholesaleStatus: row.wholesale_status,
    businessName: row.business_name,
    createdAt: row.created_at,
  };
}

// The raw row, including password_hash and token_version. Only for logging in.
export function findAccountByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
}

export function findAccountById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function getUser(id) {
  return toUser(findAccountById(id));
}

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function checkPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function createUser({ role = 'customer', name, email, password, phone = '', address = '', accountType = 'retail', businessName = '' }) {
  const normalizedEmail = email.trim().toLowerCase();
  if (findAccountByEmail(normalizedEmail)) throw conflict('An account with this email already exists.');

  const wholesale = accountType === 'wholesale';
  const user = {
    id: newId('u'),
    role,
    name,
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    phone,
    address,
    accountType,
    wholesaleStatus: wholesale ? 'pending' : null,
    businessName: wholesale ? businessName : '',
    createdAt: nowIso(),
  };

  try {
    db.prepare(
      `INSERT INTO users (id, role, name, email, password_hash, phone, address, account_type, wholesale_status, business_name, created_at)
       VALUES (@id, @role, @name, @email, @passwordHash, @phone, @address, @accountType, @wholesaleStatus, @businessName, @createdAt)`
    ).run(user);
  } catch (err) {
    // Two sign-ups with the same email at the same moment.
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') throw conflict('An account with this email already exists.');
    throw err;
  }
  return getUser(user.id);
}

export function updateProfile(userId, changes) {
  updateRow('users', { name: 'name', phone: 'phone', address: 'address' }, userId, changes);
  return getUser(userId);
}

export async function changePassword(userId, currentPassword, newPassword) {
  const account = findAccountById(userId);
  if (!(await checkPassword(currentPassword, account.password_hash))) {
    throw badRequest('Your current password is incorrect.', { currentPassword: 'Incorrect password.' });
  }
  // Bumping token_version logs out every other device that used the old password.
  db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?').run(
    await hashPassword(newPassword),
    userId
  );
  return findAccountById(userId);
}

export function applyForWholesale(userId, businessName) {
  const user = getUser(userId);
  if (user.wholesaleStatus === 'approved') throw conflict('Your account already has wholesale pricing.');
  db.prepare(
    "UPDATE users SET account_type = 'wholesale', wholesale_status = 'pending', business_name = ? WHERE id = ?"
  ).run(businessName, userId);
  return getUser(userId);
}

// ---------- Admin: customers ----------

// Customers with their purchase totals (cancelled orders are not counted).
export function listCustomers({ wholesaleStatus } = {}) {
  const filter = wholesaleStatus ? 'AND u.wholesale_status = @wholesaleStatus' : '';
  const rows = db
    .prepare(
      `SELECT u.*,
              COUNT(o.id)                 AS order_count,
              COALESCE(SUM(o.total), 0)    AS order_total,
              COALESCE(SUM(o.total_kg), 0) AS order_kg,
              MAX(o.created_at)            AS last_order_at
       FROM users u
       LEFT JOIN orders o ON o.customer_id = u.id AND o.status != 'cancelled'
       WHERE u.role = 'customer' ${filter}
       GROUP BY u.id
       ORDER BY u.name COLLATE NOCASE`
    )
    .all({ wholesaleStatus });
  return rows.map((row) => ({
    ...toUser(row),
    stats: { count: row.order_count, total: row.order_total, kg: row.order_kg, last: row.last_order_at },
  }));
}

export function getCustomer(id) {
  const user = getUser(id);
  if (!user || user.role !== 'customer') throw notFound('Customer');
  return user;
}

// 'approved' gives wholesale prices; null declines the application or removes access.
export function setWholesaleStatus(userId, wholesaleStatus) {
  const user = getCustomer(userId);
  if (wholesaleStatus === 'approved') {
    if (!user.businessName) throw badRequest('This customer has not applied for a wholesale account.');
    db.prepare("UPDATE users SET account_type = 'wholesale', wholesale_status = 'approved' WHERE id = ?").run(userId);
  } else {
    db.prepare("UPDATE users SET account_type = 'retail', wholesale_status = NULL WHERE id = ?").run(userId);
  }
  return getUser(userId);
}
