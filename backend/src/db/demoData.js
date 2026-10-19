// Demo data: the same rice varieties, suppliers, accounts and order history as the app's
// mock data (frontend/src/data/mockData.js), so the app looks the same once it uses the API.
// Order history is generated relative to today with a fixed random seed.
import bcrypt from 'bcryptjs';
import { db, transaction } from './index.js';
import { DEFAULT_SETTINGS } from './defaults.js';
import { computeCart } from '../lib/pricing.js';
import { DELIVERY_FLOW, PICKUP_FLOW, TIME_SLOTS } from '../lib/orders.js';
import { addDays } from '../lib/format.js';

const STORE = DEFAULT_SETTINGS.store;
const RIDERS = DEFAULT_SETTINGS.riders;

const products = [
  { id: 'p1', name: 'Sinandomeng Special', category: 'Premium', origin: 'Nueva Ecija', description: 'Soft, fluffy and slightly fragrant. The everyday favorite of Filipino households.', retailPrice: 52, wholesalePrice: 48, costPerKg: 43, stockKg: 1450, reorderLevel: 400, supplierId: 's1', tint: '#B7862B', active: true },
  { id: 'p2', name: 'Dinorado', category: 'Premium', origin: 'Isabela', description: 'Aromatic, slightly sticky grains with a mild sweet taste. Great for special meals.', retailPrice: 62, wholesalePrice: 57, costPerKg: 51, stockKg: 820, reorderLevel: 300, supplierId: 's2', tint: '#8C6D3F', active: true },
  { id: 'p3', name: 'Jasmine (Thai Hom Mali)', category: 'Imported', origin: 'Thailand', description: 'Long-grain fragrant rice with a floral aroma. Cooks soft and moist.', retailPrice: 68, wholesalePrice: 63, costPerKg: 56, stockKg: 260, reorderLevel: 300, supplierId: 's3', tint: '#6E8B3D', active: true },
  { id: 'p4', name: 'Coco Pandan', category: 'Premium', origin: 'Isabela', description: 'Pandan-scented, tender rice that stays soft even when cold.', retailPrice: 58, wholesalePrice: 54, costPerKg: 48, stockKg: 940, reorderLevel: 300, supplierId: 's2', tint: '#3F8F6B', active: true },
  { id: 'p5', name: 'Milagrosa', category: 'Premium', origin: 'Nueva Ecija', description: 'Premium white rice with a naturally sweet aroma and fine, glossy grains.', retailPrice: 60, wholesalePrice: 55, costPerKg: 49, stockKg: 175, reorderLevel: 250, supplierId: 's1', tint: '#A65E3A', active: true },
  { id: 'p6', name: 'Regular Milled Rice', category: 'Regular', origin: 'Nueva Ecija', description: 'Affordable, well-milled rice for daily meals, carinderias and bulk cooking.', retailPrice: 45, wholesalePrice: 42, costPerKg: 38, stockKg: 2600, reorderLevel: 800, supplierId: 's1', tint: '#6F747B', active: true },
  { id: 'p7', name: 'Malagkit (Glutinous)', category: 'Specialty', origin: 'Oriental Mindoro', description: 'Sticky rice for suman, biko, palitaw and other kakanin.', retailPrice: 75, wholesalePrice: 70, costPerKg: 62, stockKg: 90, reorderLevel: 100, supplierId: 's4', tint: '#8E6BA8', active: true },
  { id: 'p8', name: 'Brown Rice', category: 'Specialty', origin: 'Oriental Mindoro', description: 'Unpolished whole-grain rice, rich in fiber. Nutty taste, firm texture.', retailPrice: 80, wholesalePrice: 74, costPerKg: 66, stockKg: 320, reorderLevel: 150, supplierId: 's4', tint: '#8A5A2B', active: true },
  { id: 'p9', name: 'Red Rice (Organic)', category: 'Specialty', origin: 'Oriental Mindoro', description: 'Organic heirloom red rice. High in antioxidants with an earthy flavor.', retailPrice: 92, wholesalePrice: 86, costPerKg: 76, stockKg: 0, reorderLevel: 100, supplierId: 's4', tint: '#B23A3A', active: true },
  { id: 'p10', name: 'Japanese Rice (Calrose)', category: 'Imported', origin: 'California, USA', description: 'Medium-grain, slightly sticky rice. Perfect for sushi, onigiri and rice bowls.', retailPrice: 110, wholesalePrice: 102, costPerKg: 90, stockKg: 140, reorderLevel: 100, supplierId: 's3', tint: '#B8577A', active: true },
];

const suppliers = [
  { id: 's1', name: 'Nueva Ecija Rice Mill', contactPerson: 'Rodel Manalo', phone: '0917 555 0141', email: 'orders@nericemill.example', address: 'Cabanatuan City, Nueva Ecija', leadTimeDays: 2, varietyIds: ['p1', 'p5', 'p6'] },
  { id: 's2', name: 'Isabela Golden Grains Trading', contactPerson: 'Cristina Bautista', phone: '0918 555 0172', email: 'sales@goldengrains.example', address: 'Santiago City, Isabela', leadTimeDays: 3, varietyIds: ['p2', 'p4'] },
  { id: 's3', name: 'Siam Imports PH', contactPerson: 'Kevin Tan', phone: '0927 555 0193', email: 'kevin@siamimports.example', address: 'Binondo, Manila', leadTimeDays: 5, varietyIds: ['p3', 'p10'] },
  { id: 's4', name: 'Mindoro Organic Farmers Coop', contactPerson: 'Lorna Villareal', phone: '0919 555 0124', email: 'coop@mindoroorganic.example', address: 'Calapan City, Oriental Mindoro', leadTimeDays: 4, varietyIds: ['p7', 'p8', 'p9'] },
];

// The same demo logins as the app's login screen.
const users = [
  { id: 'u1', role: 'admin', name: 'Ali Mangubat', email: 'admin@bugasan.ph', password: 'admin123', phone: '0917 555 0100', address: STORE.address, accountType: 'retail', wholesaleStatus: null, businessName: '' },
  { id: 'u2', role: 'customer', name: 'Juan Dela Cruz', email: 'juan@email.com', password: '123456', phone: '0917 555 0111', address: 'Purok 2, Brgy. San Roque', accountType: 'retail', wholesaleStatus: null, businessName: '' },
  { id: 'u3', role: 'customer', name: 'Maria Santos', email: 'maria@email.com', password: '123456', phone: '0918 555 0122', address: 'Corner Rizal St., Brgy. Poblacion', accountType: 'wholesale', wholesaleStatus: 'approved', businessName: 'Aling Maria Sari-Sari Store' },
  { id: 'u4', role: 'customer', name: 'Pedro Reyes', email: 'pedro@email.com', password: '123456', phone: '0919 555 0133', address: 'National Highway, Brgy. Bagong Silang', accountType: 'wholesale', wholesaleStatus: 'approved', businessName: 'Reyes Carinderia' },
  { id: 'u5', role: 'customer', name: 'Rosa Bautista', email: 'rosa@email.com', password: '123456', phone: '0921 555 0144', address: 'Market Site, Brgy. Santa Cruz', accountType: 'wholesale', wholesaleStatus: 'approved', businessName: 'RB Grocery & Rice Center' },
  { id: 'u6', role: 'customer', name: 'Liza Gomez', email: 'liza@email.com', password: '123456', phone: '0922 555 0155', address: 'Purok 5, Brgy. Mabini', accountType: 'wholesale', wholesaleStatus: 'pending', businessName: 'Gomez Rice Retail' },
  { id: 'u7', role: 'customer', name: 'Ana Cruz', email: 'ana@email.com', password: '123456', phone: '0923 555 0166', address: 'Blk 3 Lot 9, Villa Esperanza', accountType: 'retail', wholesaleStatus: null, businessName: '' },
  { id: 'u8', role: 'customer', name: 'Mark Villanueva', email: 'mark@email.com', password: '123456', phone: '0925 555 0177', address: 'Sitio Ilaya, Brgy. San Isidro', accountType: 'retail', wholesaleStatus: null, businessName: '' },
];

const pricingRules = [
  { id: 'r1', name: 'Sack Saver', minKg: 100, type: 'percent', value: 2, appliesTo: 'all', active: true },
  { id: 'r2', name: 'Bulk Buyer', minKg: 500, type: 'percent', value: 5, appliesTo: 'all', active: true },
  { id: 'r3', name: 'Reseller Volume Deal', minKg: 1000, type: 'percent', value: 7, appliesTo: 'wholesale', active: true },
  { id: 'r4', name: 'Weekend Kilo Promo', minKg: 10, type: 'perKg', value: 1, appliesTo: 'retail', active: false },
];

const settings = { deliveryFee: DEFAULT_SETTINGS.deliveryFee, freeDeliveryMin: DEFAULT_SETTINGS.freeDeliveryMin };

// Small seeded random generator so the sample history is the same every time.
function seededRandom(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function atTime(daysAgo, hour, minute, now) {
  const d = addDays(now, -daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function buildOrder({ orderNo, customer, items, fulfillment, paymentMethod, createdAt, status, rand, now }) {
  const totals = computeCart(items, products, customer, pricingRules, settings, fulfillment);
  const flow = fulfillment === 'delivery' ? DELIVERY_FLOW : PICKUP_FLOW;
  // Status changes of today's orders must not land later than the time the seed runs.
  const notAfterNow = (date) => (date > now ? now : date).toISOString();

  const statusHistory = [];
  let time = new Date(createdAt);
  if (status === 'cancelled') {
    statusHistory.push({ status: 'pending', at: time.toISOString() });
    statusHistory.push({ status: 'cancelled', at: notAfterNow(new Date(time.getTime() + 50 * 60000)) });
  } else {
    const upto = flow.indexOf(status);
    for (let i = 0; i <= upto; i += 1) {
      statusHistory.push({ status: flow[i], at: notAfterNow(time) });
      time = new Date(time.getTime() + (25 + Math.floor(rand() * 90)) * 60000);
    }
  }

  const digital = paymentMethod !== 'cash';
  let paymentStatus = 'unpaid';
  if (status === 'delivered' || status === 'picked_up') paymentStatus = 'paid';
  else if (status === 'cancelled') paymentStatus = digital ? 'refunded' : 'unpaid';
  else if (digital) paymentStatus = rand() > 0.5 ? 'paid' : 'for_verification';

  const scheduleDate = addDays(createdAt, createdAt.getHours() >= 15 ? 1 : 0);
  const reachedOut = statusHistory.some((h) => h.status === 'out_for_delivery');

  return {
    id: `BNA-${orderNo}`,
    orderNo,
    receiptNo: `OR-${String(orderNo).padStart(6, '0')}`,
    customerId: customer.id,
    customerName: customer.businessName || customer.name,
    contactName: customer.name,
    customerPhone: customer.phone,
    channel: totals.channel,
    items: totals.lines.map((l) => ({
      productId: l.productId,
      name: l.product.name,
      unit: l.unit,
      qty: l.qty,
      kg: l.kg,
      pricePerKg: l.pricePerKg,
      priceType: l.priceType,
      subtotal: l.subtotal,
      discount: l.discount,
      ruleName: l.ruleName,
      total: l.total,
    })),
    subtotal: totals.subtotal,
    discount: totals.discount,
    deliveryFee: totals.deliveryFee,
    total: totals.total,
    totalKg: totals.totalKg,
    fulfillment,
    address: fulfillment === 'delivery' ? customer.address : STORE.address,
    scheduleDate: scheduleDate.toISOString(),
    scheduleSlot: TIME_SLOTS[Math.floor(rand() * TIME_SLOTS.length)],
    paymentMethod,
    paymentRef: digital ? `${paymentMethod.toUpperCase().slice(0, 2)}${Math.floor(1e9 + rand() * 9e9)}` : '',
    paymentStatus,
    status,
    statusHistory,
    rider: reachedOut ? RIDERS[Math.floor(rand() * RIDERS.length)] : null,
    notes: '',
    createdAt: createdAt.toISOString(),
  };
}

function generateOrders(now) {
  const rand = seededRandom(20261009);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const customers = users.filter((u) => u.role === 'customer');
  const byId = (id) => users.find((u) => u.id === id);
  const sellable = products.filter((p) => p.id !== 'p9');
  const popular = ['p1', 'p1', 'p1', 'p6', 'p6', 'p4', 'p2', 'p2', 'p5', 'p3', 'p7', 'p8', 'p10'];

  const drafts = [];

  // A few hand-made orders so the demo accounts have interesting history.
  drafts.push({ customer: byId('u2'), daysAgo: 0, hour: 8, items: [{ productId: 'p1', unit: 'half', qty: 1 }, { productId: 'p7', unit: 'kilo', qty: 3 }], fulfillment: 'delivery', paymentMethod: 'gcash', status: 'confirmed' });
  drafts.push({ customer: byId('u2'), daysAgo: 4, hour: 10, items: [{ productId: 'p4', unit: 'kilo', qty: 10 }], fulfillment: 'pickup', paymentMethod: 'cash', status: 'picked_up' });
  drafts.push({ customer: byId('u2'), daysAgo: 12, hour: 16, items: [{ productId: 'p1', unit: 'sack', qty: 1 }], fulfillment: 'delivery', paymentMethod: 'cash', status: 'delivered' });
  drafts.push({ customer: byId('u3'), daysAgo: 1, hour: 9, items: [{ productId: 'p6', unit: 'sack', qty: 4 }, { productId: 'p1', unit: 'sack', qty: 2 }], fulfillment: 'delivery', paymentMethod: 'maya', status: 'out_for_delivery' });
  drafts.push({ customer: byId('u3'), daysAgo: 9, hour: 8, items: [{ productId: 'p6', unit: 'bulk', qty: 1 }], fulfillment: 'delivery', paymentMethod: 'bank', status: 'delivered' });
  drafts.push({ customer: byId('u5'), daysAgo: 0, hour: 7, items: [{ productId: 'p6', unit: 'bulk', qty: 2 }, { productId: 'p2', unit: 'sack', qty: 6 }], fulfillment: 'delivery', paymentMethod: 'bank', status: 'pending' });
  drafts.push({ customer: byId('u7'), daysAgo: 0, hour: 9, items: [{ productId: 'p10', unit: 'kilo', qty: 5 }, { productId: 'p3', unit: 'kilo', qty: 5 }], fulfillment: 'pickup', paymentMethod: 'cash', status: 'pending' });

  // Random history for the last 35 days.
  for (let i = 0; i < 72; i += 1) {
    const customer = pick(customers);
    const wholesale = customer.wholesaleStatus === 'approved';
    const daysAgo = Math.floor(Math.pow(rand(), 1.3) * 35);
    const itemCount = 1 + Math.floor(rand() * (wholesale ? 3 : 2));
    const items = [];
    for (let k = 0; k < itemCount; k += 1) {
      const productId = rand() > 0.25 ? pick(popular) : pick(sellable).id;
      if (items.some((it) => it.productId === productId)) continue;
      let unit;
      let qty;
      const r = rand();
      if (wholesale) {
        if (r > 0.85) { unit = 'bulk'; qty = 1; }
        else if (r > 0.25) { unit = 'sack'; qty = 1 + Math.floor(rand() * 6); }
        else { unit = 'half'; qty = 1 + Math.floor(rand() * 4); }
      } else if (r > 0.75) { unit = 'sack'; qty = 1; }
      else if (r > 0.45) { unit = 'half'; qty = 1; }
      else { unit = 'kilo'; qty = pick([2, 3, 5, 5, 10, 10, 15, 20]); }
      // Bulk lots are only for everyday rice; specialty/imported rice moves by the sack.
      if (unit === 'bulk' && !['p1', 'p4', 'p6'].includes(productId)) { unit = 'sack'; qty = 2; }
      if (wholesale && ['p3', 'p7', 'p8', 'p10'].includes(productId) && unit === 'sack') qty = Math.min(qty, 2);
      items.push({ productId, unit, qty });
    }
    const fulfillment = rand() > 0.42 ? 'delivery' : 'pickup';
    const paymentMethod = pick(['cash', 'cash', 'cash', 'gcash', 'gcash', 'maya', 'bank']);
    let status;
    if (rand() < 0.07) status = 'cancelled';
    else if (daysAgo >= 2) status = fulfillment === 'delivery' ? 'delivered' : 'picked_up';
    else if (daysAgo === 1) status = pick(fulfillment === 'delivery' ? ['preparing', 'delivered', 'delivered'] : ['ready_for_pickup', 'picked_up']);
    else status = pick(['pending', 'confirmed', 'preparing']);
    drafts.push({ customer, daysAgo, hour: 7 + Math.floor(rand() * 10), items, fulfillment, paymentMethod, status });
  }

  const withDates = drafts.map((d, i) => {
    let createdAt = atTime(d.daysAgo, d.hour, Math.floor(rand() * 60), now);
    // When the seed runs early in the day, "today's" orders would be in the future: move them
    // to earlier today so real new orders still sort first.
    if (createdAt > now) createdAt = new Date(now.getTime() - (((i * 7) % 90) + 1) * 60000);
    return { ...d, createdAt };
  });
  withDates.sort((a, b) => a.createdAt - b.createdAt);

  return withDates.map((d, index) => buildOrder({ orderNo: 10001 + index, ...d, rand, now }));
}

function generatePurchaseOrders(now) {
  const line = (productId, sackCount, costPerKg) => {
    const product = products.find((p) => p.id === productId);
    const kgTotal = sackCount * 50;
    return { productId, name: product.name, sacks: sackCount, kg: kgTotal, costPerKg, total: kgTotal * costPerKg };
  };
  const po = (no, supplierId, orderedDaysAgo, status, items, receivedDaysAgo, notes = '') => {
    const orderedAt = atTime(orderedDaysAgo, 9, 30, now);
    const supplier = suppliers.find((s) => s.id === supplierId);
    return {
      id: `PO-${no}`,
      poNo: no,
      supplierId,
      supplierName: supplier.name,
      items,
      totalKg: items.reduce((s, i) => s + i.kg, 0),
      totalCost: items.reduce((s, i) => s + i.total, 0),
      status,
      orderedAt: orderedAt.toISOString(),
      expectedAt: addDays(orderedAt, supplier.leadTimeDays).toISOString(),
      receivedAt: receivedDaysAgo != null ? atTime(receivedDaysAgo, 14, 0, now).toISOString() : null,
      notes,
    };
  };

  return [
    po(1001, 's1', 40, 'received', [line('p1', 30, 43), line('p6', 40, 38)], 38),
    po(1002, 's2', 33, 'received', [line('p2', 20, 51), line('p4', 20, 48)], 30),
    po(1003, 's4', 28, 'received', [line('p7', 6, 62), line('p8', 8, 66), line('p9', 6, 76)], 24),
    po(1004, 's3', 25, 'received', [line('p3', 12, 56), line('p10', 6, 90)], 20),
    po(1005, 's1', 18, 'received', [line('p1', 20, 43), line('p5', 10, 49), line('p6', 30, 38)], 16),
    po(1006, 's1', 12, 'cancelled', [line('p5', 6, 49)], null, 'Supplier ran out of Milagrosa stock.'),
    po(1007, 's2', 10, 'received', [line('p2', 10, 51), line('p4', 12, 48)], 7),
    po(1008, 's4', 3, 'ordered', [line('p9', 8, 76), line('p7', 4, 62)], null, 'Rush order — red rice is out of stock.'),
    po(1009, 's3', 1, 'ordered', [line('p3', 10, 56)], null),
  ];
}

function generateMovements(orders, purchaseOrders, now) {
  const movements = [];
  const push = (m) => movements.push(m);

  purchaseOrders
    .filter((po) => po.status === 'received')
    .forEach((po) => po.items.forEach((item) => push({ productId: item.productId, type: 'restock', kg: item.kg, ref: po.id, note: po.supplierName, at: po.receivedAt })));

  orders.forEach((order) => {
    order.items.forEach((item) => push({ productId: item.productId, type: 'sale', kg: -item.kg, ref: order.id, note: order.customerName, at: order.createdAt }));
    if (order.status === 'cancelled') {
      const cancelledAt = order.statusHistory[order.statusHistory.length - 1].at;
      order.items.forEach((item) => push({ productId: item.productId, type: 'return', kg: item.kg, ref: order.id, note: 'Order cancelled', at: cancelledAt }));
    }
  });

  push({ productId: 'p6', type: 'adjustment', kg: -12, ref: 'ADJ', note: 'Damaged sack (wet)', at: atTime(6, 17, 10, now).toISOString() });
  push({ productId: 'p8', type: 'adjustment', kg: 5, ref: 'ADJ', note: 'Physical count correction', at: atTime(2, 18, 0, now).toISOString() });

  // Oldest first, so the ids go up with time.
  return movements.sort((a, b) => new Date(a.at) - new Date(b.at));
}

const TABLES = [
  'stock_movements',
  'order_items',
  'orders',
  'purchase_order_items',
  'purchase_orders',
  'supplier_varieties',
  'products',
  'suppliers',
  'pricing_rules',
  'users',
  'settings',
];

export function hasData() {
  return db.prepare('SELECT COUNT(*) FROM users').pluck().get() > 0;
}

// Wipes every table and loads the demo data.
export function seedDemoData() {
  const now = new Date();
  const orders = generateOrders(now);
  const purchaseOrders = generatePurchaseOrders(now);
  const movements = generateMovements(orders, purchaseOrders, now);

  // Two distinct demo passwords, so hash each once.
  const hashes = new Map();
  const hash = (pw) => {
    if (!hashes.has(pw)) hashes.set(pw, bcrypt.hashSync(pw, 10));
    return hashes.get(pw);
  };

  transaction(() => {
    TABLES.forEach((table) => db.prepare(`DELETE FROM ${table}`).run());
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('order_items', 'purchase_order_items', 'stock_movements')").run();

    const setting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => setting.run(key, JSON.stringify(value)));

    const userRow = db.prepare(
      `INSERT INTO users (id, role, name, email, password_hash, phone, address, account_type, wholesale_status, business_name, created_at)
       VALUES (@id, @role, @name, @email, @hash, @phone, @address, @accountType, @wholesaleStatus, @businessName, @createdAt)`
    );
    const created = addDays(now, -60).toISOString();
    users.forEach((u) => userRow.run({ ...u, hash: hash(u.password), createdAt: created }));

    const supplierRow = db.prepare(
      `INSERT INTO suppliers (id, name, contact_person, phone, email, address, lead_time_days)
       VALUES (@id, @name, @contactPerson, @phone, @email, @address, @leadTimeDays)`
    );
    suppliers.forEach((s) => supplierRow.run(s));

    const productRow = db.prepare(
      `INSERT INTO products (id, name, category, origin, description, retail_price, wholesale_price, cost_per_kg,
                             stock_kg, reorder_level, supplier_id, tint, active)
       VALUES (@id, @name, @category, @origin, @description, @retailPrice, @wholesalePrice, @costPerKg,
               @stockKg, @reorderLevel, @supplierId, @tint, @active)`
    );
    products.forEach((p) => productRow.run({ ...p, active: Number(p.active) }));

    const varietyRow = db.prepare('INSERT INTO supplier_varieties (supplier_id, product_id) VALUES (?, ?)');
    suppliers.forEach((s) => s.varietyIds.forEach((pid) => varietyRow.run(s.id, pid)));

    const ruleRow = db.prepare(
      `INSERT INTO pricing_rules (id, name, min_kg, type, value, applies_to, active)
       VALUES (@id, @name, @minKg, @type, @value, @appliesTo, @active)`
    );
    pricingRules.forEach((r) => ruleRow.run({ ...r, active: Number(r.active) }));

    const orderRow = db.prepare(
      `INSERT INTO orders (id, order_no, receipt_no, customer_id, customer_name, contact_name, customer_phone, channel,
                           subtotal, discount, delivery_fee, total, total_kg, fulfillment, address, schedule_date,
                           schedule_slot, payment_method, payment_ref, payment_status, status, status_history, rider, notes, created_at)
       VALUES (@id, @orderNo, @receiptNo, @customerId, @customerName, @contactName, @customerPhone, @channel,
               @subtotal, @discount, @deliveryFee, @total, @totalKg, @fulfillment, @address, @scheduleDate,
               @scheduleSlot, @paymentMethod, @paymentRef, @paymentStatus, @status, @statusHistory, @rider, @notes, @createdAt)`
    );
    const orderItemRow = db.prepare(
      `INSERT INTO order_items (order_id, product_id, name, unit, qty, kg, price_per_kg, price_type, subtotal, discount, rule_name, total)
       VALUES (@orderId, @productId, @name, @unit, @qty, @kg, @pricePerKg, @priceType, @subtotal, @discount, @ruleName, @total)`
    );
    orders.forEach((o) => {
      orderRow.run({ ...o, statusHistory: JSON.stringify(o.statusHistory), rider: o.rider ? JSON.stringify(o.rider) : null });
      o.items.forEach((item) => orderItemRow.run({ orderId: o.id, ...item }));
    });

    const poRow = db.prepare(
      `INSERT INTO purchase_orders (id, po_no, supplier_id, supplier_name, total_kg, total_cost, status, ordered_at, expected_at, received_at, notes)
       VALUES (@id, @poNo, @supplierId, @supplierName, @totalKg, @totalCost, @status, @orderedAt, @expectedAt, @receivedAt, @notes)`
    );
    const poItemRow = db.prepare(
      `INSERT INTO purchase_order_items (po_id, product_id, name, sacks, kg, cost_per_kg, total)
       VALUES (@poId, @productId, @name, @sacks, @kg, @costPerKg, @total)`
    );
    purchaseOrders.forEach((po) => {
      poRow.run(po);
      po.items.forEach((item) => poItemRow.run({ poId: po.id, ...item }));
    });

    const movementRow = db.prepare(
      'INSERT INTO stock_movements (product_id, type, kg, ref, note, at) VALUES (@productId, @type, @kg, @ref, @note, @at)'
    );
    movements.forEach((m) => movementRow.run(m));
  });

  return { users: users.length, products: products.length, orders: orders.length, purchaseOrders: purchaseOrders.length };
}
