// Rice suppliers and the varieties each one sells.
import { db, groupBy, transaction, updateRow } from '../db/index.js';
import { badRequest, notFound } from '../lib/errors.js';
import { newId } from '../lib/ids.js';

function toSupplier(row, varietyIds = []) {
  return {
    id: row.id,
    name: row.name,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    address: row.address,
    leadTimeDays: row.lead_time_days,
    varietyIds,
  };
}

export function listSuppliers() {
  const rows = db.prepare('SELECT * FROM suppliers ORDER BY rowid').all();
  const varieties = groupBy(db.prepare('SELECT * FROM supplier_varieties ORDER BY rowid').all(), 'supplier_id');
  return rows.map((row) => toSupplier(row, (varieties.get(row.id) || []).map((v) => v.product_id)));
}

export function getSupplier(id) {
  const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  if (!row) return null;
  const ids = db.prepare('SELECT product_id FROM supplier_varieties WHERE supplier_id = ? ORDER BY rowid').pluck().all(id);
  return toSupplier(row, ids);
}

export function requireSupplier(id) {
  const supplier = getSupplier(id);
  if (!supplier) throw notFound('Supplier');
  return supplier;
}

// Links varieties to a supplier (keeps the ones already linked).
export function addVarieties(supplierId, productIds) {
  const insert = db.prepare('INSERT OR IGNORE INTO supplier_varieties (supplier_id, product_id) VALUES (?, ?)');
  productIds.forEach((productId) => insert.run(supplierId, productId));
}

function checkVarieties(productIds = []) {
  const known = new Set(db.prepare('SELECT id FROM products').pluck().all());
  const unknown = productIds.filter((pid) => !known.has(pid));
  if (unknown.length) throw badRequest(`Unknown rice variety: ${unknown.join(', ')}.`, { varietyIds: 'Unknown rice variety.' });
}

export function createSupplier({ varietyIds = [], ...data }) {
  checkVarieties(varietyIds);
  const id = newId('s');
  transaction(() => {
    db.prepare(
      `INSERT INTO suppliers (id, name, contact_person, phone, email, address, lead_time_days)
       VALUES (@id, @name, @contactPerson, @phone, @email, @address, @leadTimeDays)`
    ).run({ contactPerson: '', phone: '', email: '', address: '', leadTimeDays: 3, ...data, id });
    addVarieties(id, varietyIds);
  });
  return getSupplier(id);
}

const EDITABLE = {
  name: 'name',
  contactPerson: 'contact_person',
  phone: 'phone',
  email: 'email',
  address: 'address',
  leadTimeDays: 'lead_time_days',
};

// varietyIds, when given, replaces the supplier's whole variety list.
export function updateSupplier(id, { varietyIds, ...changes }) {
  requireSupplier(id);
  if (varietyIds) checkVarieties(varietyIds);
  transaction(() => {
    updateRow('suppliers', EDITABLE, id, changes);
    if (varietyIds) {
      db.prepare('DELETE FROM supplier_varieties WHERE supplier_id = ?').run(id);
      addVarieties(id, varietyIds);
    }
  });
  return getSupplier(id);
}
