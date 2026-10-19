// Rice varieties, stock levels and the stock movement history.
import { db, toDb, transaction, updateRow } from '../db/index.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { newId, nowIso } from '../lib/ids.js';
import { getSettings } from './settings.js';

export function toProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    origin: row.origin,
    description: row.description,
    retailPrice: row.retail_price,
    wholesalePrice: row.wholesale_price,
    costPerKg: row.cost_per_kg,
    stockKg: row.stock_kg,
    reorderLevel: row.reorder_level,
    supplierId: row.supplier_id,
    tint: row.tint,
    active: !!row.active,
  };
}

// Customers do not see what the store paid for the rice or who supplied it.
export function forCustomer(product) {
  const { costPerKg, supplierId, ...rest } = product;
  return rest;
}

export function toMovement(row) {
  return { id: `m${row.id}`, productId: row.product_id, type: row.type, kg: row.kg, ref: row.ref, note: row.note, at: row.at };
}

export function listProducts({ includeInactive = true } = {}) {
  const where = includeInactive ? '' : 'WHERE active = 1';
  return db.prepare(`SELECT * FROM products ${where} ORDER BY rowid`).all().map(toProduct);
}

export function getProduct(id) {
  return toProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
}

export function requireProduct(id) {
  const product = getProduct(id);
  if (!product) throw notFound('Rice variety');
  return product;
}

function checkProductFields(product) {
  if (product.wholesalePrice > product.retailPrice) {
    throw badRequest('Wholesale price should not be higher than retail.', { wholesalePrice: 'Must not be higher than retail.' });
  }
  const { categories } = getSettings();
  if (!categories.includes(product.category)) {
    throw badRequest(`Category must be one of: ${categories.join(', ')}.`, { category: 'Unknown category.' });
  }
  if (product.supplierId && !db.prepare('SELECT 1 FROM suppliers WHERE id = ?').get(product.supplierId)) {
    throw badRequest('Supplier not found.', { supplierId: 'Supplier not found.' });
  }
}

// Logs one stock change. kg is negative for sales, positive for restocks and returns.
export function addMovement({ productId, type, kg, ref = '', note = '', at = nowIso() }) {
  db.prepare('INSERT INTO stock_movements (product_id, type, kg, ref, note, at) VALUES (?, ?, ?, ?, ?, ?)').run(
    productId,
    type,
    kg,
    ref,
    note,
    at
  );
}

// Adds (or removes, if negative) kilos from a variety. Fails instead of going below zero.
// Call inside a transaction together with addMovement.
export function changeStock(productId, kgChange) {
  const result = db
    .prepare('UPDATE products SET stock_kg = ROUND(stock_kg + @kg, 3) WHERE id = @id AND stock_kg + @kg >= 0')
    .run({ id: productId, kg: kgChange });
  if (result.changes === 0) {
    const product = requireProduct(productId);
    throw conflict(`Not enough stock for ${product.name}. Only ${product.stockKg} kg left.`);
  }
}

export function createProduct(data) {
  const product = {
    id: newId('p'),
    supplierId: null,
    tint: '#B7862B',
    active: true,
    ...data,
    description: data.description || `${data.name} rice from ${data.origin}.`,
  };
  checkProductFields(product);

  transaction(() => {
    db.prepare(
      `INSERT INTO products (id, name, category, origin, description, retail_price, wholesale_price, cost_per_kg,
                             stock_kg, reorder_level, supplier_id, tint, active)
       VALUES (@id, @name, @category, @origin, @description, @retailPrice, @wholesalePrice, @costPerKg,
               @stockKg, @reorderLevel, @supplierId, @tint, @active)`
    ).run({ ...product, active: toDb(product.active) });
    if (product.stockKg > 0) {
      addMovement({ productId: product.id, type: 'adjustment', kg: product.stockKg, ref: 'NEW', note: 'Opening stock' });
    }
    if (product.supplierId) {
      db.prepare('INSERT OR IGNORE INTO supplier_varieties (supplier_id, product_id) VALUES (?, ?)').run(product.supplierId, product.id);
    }
  });
  return getProduct(product.id);
}

const EDITABLE = {
  name: 'name',
  category: 'category',
  origin: 'origin',
  description: 'description',
  retailPrice: 'retail_price',
  wholesalePrice: 'wholesale_price',
  costPerKg: 'cost_per_kg',
  reorderLevel: 'reorder_level',
  supplierId: 'supplier_id',
  tint: 'tint',
  active: 'active',
};

// Stock is not editable here: it only changes through orders, purchase orders and adjustments,
// so every kilo shows up in the movement history.
export function updateProduct(id, changes) {
  const merged = { ...requireProduct(id), ...changes };
  checkProductFields(merged);
  updateRow('products', EDITABLE, id, changes);
  return getProduct(id);
}

export function adjustStock(id, kgChange, note) {
  requireProduct(id);
  transaction(() => {
    changeStock(id, kgChange);
    addMovement({ productId: id, type: 'adjustment', kg: kgChange, ref: 'ADJ', note });
  });
  return getProduct(id);
}

export function listMovements({ productId, since, limit = 200 } = {}) {
  const where = [];
  if (productId) where.push('product_id = @productId');
  if (since) where.push('at >= @since');
  const sql = `SELECT * FROM stock_movements ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
               ORDER BY at DESC, id DESC LIMIT @limit`;
  return db.prepare(sql).all({ productId, since, limit }).map(toMovement);
}

// Kilos of one variety sold (non-cancelled orders) since a date.
export function soldKgSince(productId, since) {
  return db
    .prepare(
      `SELECT COALESCE(SUM(i.kg), 0) AS kg FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE i.product_id = ? AND o.status != 'cancelled' AND o.created_at >= ?`
    )
    .get(productId, since).kg;
}
