// Discount and bulk-pricing rules (e.g. 2% off 100 kg+, 5% off 500 kg+).
import { db, toDb, updateRow } from '../db/index.js';
import { badRequest, notFound } from '../lib/errors.js';
import { newId } from '../lib/ids.js';

function toRule(row) {
  return {
    id: row.id,
    name: row.name,
    minKg: row.min_kg,
    type: row.type,
    value: row.value,
    appliesTo: row.applies_to,
    active: !!row.active,
  };
}

export function listRules({ activeOnly = false } = {}) {
  const where = activeOnly ? 'WHERE active = 1' : '';
  return db.prepare(`SELECT * FROM pricing_rules ${where} ORDER BY min_kg, rowid`).all().map(toRule);
}

function requireRule(id) {
  const row = db.prepare('SELECT * FROM pricing_rules WHERE id = ?').get(id);
  if (!row) throw notFound('Discount rule');
  return toRule(row);
}

function checkRule(rule) {
  if (rule.type === 'percent' && rule.value > 100) {
    throw badRequest('A percent discount cannot be more than 100%.', { value: 'At most 100.' });
  }
}

export function createRule(data) {
  const rule = { id: newId('r'), active: true, ...data };
  checkRule(rule);
  db.prepare(
    `INSERT INTO pricing_rules (id, name, min_kg, type, value, applies_to, active)
     VALUES (@id, @name, @minKg, @type, @value, @appliesTo, @active)`
  ).run({ ...rule, active: toDb(rule.active) });
  return requireRule(rule.id);
}

export function updateRule(id, changes) {
  checkRule({ ...requireRule(id), ...changes });
  updateRow(
    'pricing_rules',
    { name: 'name', minKg: 'min_kg', type: 'type', value: 'value', appliesTo: 'applies_to', active: 'active' },
    id,
    changes
  );
  return requireRule(id);
}

export function deleteRule(id) {
  requireRule(id);
  db.prepare('DELETE FROM pricing_rules WHERE id = ?').run(id);
}
