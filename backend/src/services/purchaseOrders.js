// Purchase orders to suppliers. Receiving one adds the rice to inventory.
import { db, groupBy, transaction } from '../db/index.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { nowIso } from '../lib/ids.js';
import { SACK_KG, round2 } from '../lib/pricing.js';
import { addMovement, changeStock, getProduct } from './products.js';
import { addVarieties, requireSupplier } from './suppliers.js';

function toPurchaseOrder(row, itemRows) {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    items: itemRows.map((i) => ({
      productId: i.product_id,
      name: i.name,
      sacks: i.sacks,
      kg: i.kg,
      costPerKg: i.cost_per_kg,
      total: i.total,
    })),
    totalKg: row.total_kg,
    totalCost: row.total_cost,
    status: row.status,
    orderedAt: row.ordered_at,
    expectedAt: row.expected_at,
    receivedAt: row.received_at,
    notes: row.notes,
  };
}

function loadPurchaseOrders(where = '1 = 1', params = {}) {
  const rows = db.prepare(`SELECT * FROM purchase_orders WHERE ${where} ORDER BY ordered_at DESC, po_no DESC`).all(params);
  if (!rows.length) return [];
  const items = db
    .prepare('SELECT * FROM purchase_order_items WHERE po_id IN (SELECT value FROM json_each(?)) ORDER BY id')
    .all(JSON.stringify(rows.map((r) => r.id)));
  const byPo = groupBy(items, 'po_id');
  return rows.map((row) => toPurchaseOrder(row, byPo.get(row.id) || []));
}

export function listPurchaseOrders({ supplierId, status, since } = {}) {
  const where = ['1 = 1'];
  if (supplierId) where.push('supplier_id = @supplierId');
  if (status) where.push('status = @status');
  if (since) where.push('ordered_at >= @since');
  return loadPurchaseOrders(where.join(' AND '), { supplierId, status, since });
}

export function requirePurchaseOrder(id) {
  const po = loadPurchaseOrders('id = @id', { id })[0];
  if (!po) throw notFound('Purchase order');
  return po;
}

export function createPurchaseOrder({ supplierId, items, expectedAt, notes }) {
  const supplier = requireSupplier(supplierId);
  const lines = items.map((item) => {
    const product = getProduct(item.productId);
    if (!product) throw badRequest(`Unknown rice variety: ${item.productId}.`);
    const kg = item.sacks * SACK_KG;
    return { productId: product.id, name: product.name, sacks: item.sacks, kg, costPerKg: item.costPerKg, total: round2(kg * item.costPerKg) };
  });

  return transaction(() => {
    const poNo = db.prepare('SELECT COALESCE(MAX(po_no), 1000) + 1 FROM purchase_orders').pluck().get();
    const id = `PO-${poNo}`;
    db.prepare(
      `INSERT INTO purchase_orders (id, po_no, supplier_id, supplier_name, total_kg, total_cost, status, ordered_at, expected_at, notes)
       VALUES (@id, @poNo, @supplierId, @supplierName, @totalKg, @totalCost, 'ordered', @orderedAt, @expectedAt, @notes)`
    ).run({
      id,
      poNo,
      supplierId,
      supplierName: supplier.name,
      totalKg: lines.reduce((sum, l) => sum + l.kg, 0),
      totalCost: round2(lines.reduce((sum, l) => sum + l.total, 0)),
      orderedAt: nowIso(),
      expectedAt,
      notes,
    });
    const insertItem = db.prepare(
      `INSERT INTO purchase_order_items (po_id, product_id, name, sacks, kg, cost_per_kg, total)
       VALUES (@poId, @productId, @name, @sacks, @kg, @costPerKg, @total)`
    );
    lines.forEach((line) => insertItem.run({ poId: id, ...line }));
    // The supplier now counts as a source of these varieties.
    addVarieties(supplierId, lines.map((l) => l.productId));
    return requirePurchaseOrder(id);
  });
}

// The delivery arrived: add the rice to stock and update each variety's cost price.
export function receivePurchaseOrder(id) {
  return transaction(() => {
    const po = requirePurchaseOrder(id);
    if (po.status !== 'ordered') throw conflict(`${id} is already ${po.status}.`);
    const receivedAt = nowIso();

    const byProduct = groupBy(po.items, 'productId');
    for (const [productId, lines] of byProduct) {
      const kgIn = lines.reduce((sum, l) => sum + l.kg, 0);
      changeStock(productId, kgIn);
      db.prepare('UPDATE products SET cost_per_kg = ? WHERE id = ?').run(lines[lines.length - 1].costPerKg, productId);
      addMovement({ productId, type: 'restock', kg: kgIn, ref: po.id, note: po.supplierName, at: receivedAt });
    }
    db.prepare("UPDATE purchase_orders SET status = 'received', received_at = ? WHERE id = ?").run(receivedAt, id);
    return requirePurchaseOrder(id);
  });
}

export function cancelPurchaseOrder(id) {
  const po = requirePurchaseOrder(id);
  if (po.status !== 'ordered') throw conflict(`${id} is already ${po.status}.`);
  db.prepare("UPDATE purchase_orders SET status = 'cancelled' WHERE id = ?").run(id);
  return requirePurchaseOrder(id);
}
