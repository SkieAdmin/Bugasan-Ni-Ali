// Store settings: delivery fee, free-delivery minimum, store info, riders and rice categories.
import { db, transaction } from '../db/index.js';

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
}

// Just the part the pricing rules need (same shape as state.settings in the app).
export function deliverySettings(settings = getSettings()) {
  return { deliveryFee: settings.deliveryFee, freeDeliveryMin: settings.freeDeliveryMin };
}

export function updateSettings(changes) {
  const current = getSettings();
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'
  );
  transaction(() => {
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) continue;
      // Store info is merged, so one field (e.g. hours) can be changed on its own.
      const next = key === 'store' ? { ...current.store, ...value } : value;
      upsert.run(key, JSON.stringify(next));
    }
  });
  return getSettings();
}
