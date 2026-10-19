// End-to-end API tests on a fresh in-memory database with the demo data.  npm test
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';

const { app } = await import('../src/app.js');
const { seedDemoData } = await import('../src/db/demoData.js');

let server;
let base;
let admin;
let juan;
let maria;

before(async () => {
  seedDemoData();
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
  admin = await login('admin@bugasan.ph', 'admin123');
  juan = await login('juan@email.com', '123456');
  maria = await login('maria@email.com', '123456');
});

after(() => server.close());

async function api(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body && { 'content-type': 'application/json' }),
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, data: res.status === 204 ? null : await res.json() };
}

async function login(email, password) {
  const res = await api('POST', '/auth/login', { body: { email, password } });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  return res.data.token;
}

const stockOf = async (token, productId) => (await api('GET', `/products/${productId}`, { token })).data.product.stockKg;

const tomorrow = () => new Date(Date.now() + 24 * 3600 * 1000).toISOString();

const order = (items, extra = {}) => ({
  items,
  fulfillment: 'delivery',
  address: 'Purok 2, Brgy. San Roque',
  schedule: { date: tomorrow(), slot: '10:00 AM – 12:00 NN' },
  paymentMethod: 'cash',
  ...extra,
});

describe('auth', () => {
  test('rejects a wrong password and a missing token', async () => {
    assert.equal((await api('POST', '/auth/login', { body: { email: 'juan@email.com', password: 'x' } })).status, 401);
    assert.equal((await api('GET', '/orders')).status, 401);
    assert.equal((await api('GET', '/orders', { token: 'garbage' })).status, 401);
  });

  test('registers a customer, validates the form and blocks duplicate emails', async () => {
    const bad = await api('POST', '/auth/register', { body: { name: 'A', email: 'not-an-email', password: '1', phone: '1', address: '' } });
    assert.equal(bad.status, 400);
    assert.ok(bad.data.fields.email && bad.data.fields.password && bad.data.fields.phone);

    const form = { name: 'Lito Ramos', email: 'Lito@Email.com', password: 'secret1', phone: '0917 555 0199', address: 'Brgy. Uno' };
    const ok = await api('POST', '/auth/register', { body: form });
    assert.equal(ok.status, 201);
    assert.equal(ok.data.user.email, 'lito@email.com');
    assert.equal(ok.data.user.role, 'customer');
    assert.equal(ok.data.user.password_hash, undefined);

    const again = await api('POST', '/auth/register', { body: { ...form, email: 'LITO@email.com' } });
    assert.equal(again.status, 409);
  });

  test('cannot register as admin', async () => {
    const res = await api('POST', '/auth/register', {
      body: { name: 'Sneaky', email: 'sneaky@email.com', password: 'secret1', phone: '0917 555 0198', address: 'x', role: 'admin' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.user.role, 'customer');
  });

  test('changing the password logs out old tokens', async () => {
    const token = await login('ana@email.com', '123456');
    const res = await api('POST', '/me/password', { token, body: { currentPassword: '123456', newPassword: 'newpass1' } });
    assert.equal(res.status, 200);
    assert.equal((await api('GET', '/me', { token })).status, 401);
    assert.equal((await api('GET', '/me', { token: res.data.token })).status, 200);
  });
});

describe('catalog', () => {
  test('customers do not see cost prices; the admin does', async () => {
    const customer = (await api('GET', '/products', { token: juan })).data.products;
    assert.equal(customer[0].costPerKg, undefined);
    assert.equal(customer[0].supplierId, undefined);
    const full = (await api('GET', '/products', { token: admin })).data.products;
    assert.equal(full[0].costPerKg, 43);
  });

  test('only the admin can change products', async () => {
    assert.equal((await api('PATCH', '/products/p1', { token: juan, body: { retailPrice: 1 } })).status, 403);
    const bad = await api('PATCH', '/products/p1', { token: admin, body: { wholesalePrice: 999 } });
    assert.equal(bad.status, 400);
  });

  test('adds a variety with opening stock', async () => {
    const body = { name: 'Ifugao Tinawon', category: 'Specialty', origin: 'Ifugao', retailPrice: 120, wholesalePrice: 110, costPerKg: 95, stockKg: 75, reorderLevel: 20, supplierId: 's4' };
    assert.equal((await api('POST', '/products', { token: admin, body: { ...body, category: 'Nope' } })).status, 400);
    const res = await api('POST', '/products', { token: admin, body });
    assert.equal(res.status, 201);
    assert.equal(res.data.product.tint, '#B7862B');
    const history = await api('GET', `/products/${res.data.product.id}/movements`, { token: admin });
    assert.equal(history.data.movements[0].kg, 75);
    const supplier = await api('GET', '/suppliers/s4', { token: admin });
    assert.ok(supplier.data.supplier.varietyIds.includes(res.data.product.id));
  });
});

describe('orders', () => {
  test('server computes the price and deducts stock (retail)', async () => {
    const before = await stockOf(admin, 'p1');
    const res = await api('POST', '/orders', {
      token: juan,
      body: { ...order([{ productId: 'p1', unit: 'sack', qty: 1 }]), total: 1, subtotal: 1 },
    });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    const o = res.data.order;
    assert.equal(o.channel, 'retail');
    assert.equal(o.subtotal, 2600); // 50 kg × ₱52, sent totals ignored
    assert.equal(o.deliveryFee, 80); // below ₱3,000
    assert.equal(o.total, 2680);
    assert.equal(o.status, 'pending');
    assert.equal(o.paymentStatus, 'unpaid');
    assert.match(o.id, /^BNA-\d+$/);
    assert.equal(o.receiptNo, `OR-${o.id.slice(4).padStart(6, '0')}`);
    assert.equal(await stockOf(admin, 'p1'), before - 50);
  });

  test('wholesale prices on sacks, retail on kilos, best discount rule per line', async () => {
    const res = await api('POST', '/orders', {
      token: maria,
      body: order(
        [
          { productId: 'p6', unit: 'sack', qty: 2 },
          { productId: 'p6', unit: 'kilo', qty: 5 },
        ],
        { fulfillment: 'pickup', paymentMethod: 'gcash', paymentRef: 'GC123456789' }
      ),
    });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    const [sacks, kilos] = res.data.order.items;
    assert.equal(sacks.priceType, 'wholesale');
    assert.equal(sacks.subtotal, 4200);
    assert.equal(sacks.discount, 84); // Sack Saver 2% (100 kg+)
    assert.equal(kilos.priceType, 'retail');
    assert.equal(kilos.subtotal, 225);
    assert.equal(res.data.order.deliveryFee, 0);
    assert.equal(res.data.order.address, 'Stall 12, Public Market Rd., Brgy. Poblacion');
    assert.equal(res.data.order.paymentStatus, 'for_verification');
  });

  test('validates checkout input', async () => {
    const noRef = await api('POST', '/orders', { token: maria, body: order([{ productId: 'p1', unit: 'kilo', qty: 1 }], { paymentMethod: 'bank' }) });
    assert.equal(noRef.status, 400);
    assert.ok(noRef.data.fields.paymentRef);
    const noAddress = await api('POST', '/orders', { token: juan, body: order([{ productId: 'p1', unit: 'kilo', qty: 1 }], { address: '' }) });
    assert.equal(noAddress.status, 400);
    const empty = await api('POST', '/orders', { token: juan, body: order([]) });
    assert.equal(empty.status, 400);
    const badUnit = await api('POST', '/orders', { token: juan, body: order([{ productId: 'p1', unit: 'ton', qty: 1 }]) });
    assert.equal(badUnit.status, 400);
    const adminOrder = await api('POST', '/orders', { token: admin, body: order([{ productId: 'p1', unit: 'kilo', qty: 1 }]) });
    assert.equal(adminOrder.status, 403);
  });

  test('refuses orders without enough stock and changes nothing', async () => {
    const before = await stockOf(admin, 'p1');
    const out = await api('POST', '/orders', { token: juan, body: order([{ productId: 'p9', unit: 'kilo', qty: 1 }]) });
    assert.equal(out.status, 409);
    const mixed = await api('POST', '/orders', {
      token: juan,
      body: order([
        { productId: 'p1', unit: 'kilo', qty: 5 },
        { productId: 'p7', unit: 'sack', qty: 2 }, // only 90 kg
      ]),
    });
    assert.equal(mixed.status, 409);
    assert.match(mixed.data.error, /Malagkit/);
    assert.equal(await stockOf(admin, 'p1'), before);
  });

  test('quote matches what placing the order charges', async () => {
    const cart = { items: [{ productId: 'p2', unit: 'half', qty: 3 }], fulfillment: 'delivery' };
    const quote = (await api('POST', '/orders/quote', { token: juan, body: cart })).data.quote;
    const placed = (await api('POST', '/orders', { token: juan, body: order(cart.items) })).data.order;
    assert.equal(quote.total, placed.total);
    assert.equal(quote.discount, placed.discount);
  });

  test('customers only see their own orders', async () => {
    const mine = (await api('GET', '/orders', { token: juan })).data.orders;
    assert.ok(mine.length > 0 && mine.every((o) => o.customerId === 'u2'));
    const marias = (await api('GET', '/orders', { token: maria })).data.orders[0];
    assert.equal((await api('GET', `/orders/${marias.id}`, { token: juan })).status, 404);
    assert.equal((await api('POST', `/orders/${marias.id}/cancel`, { token: juan })).status, 404);
  });

  test('customer cancels a pending order and the rice goes back', async () => {
    const placed = (await api('POST', '/orders', { token: juan, body: order([{ productId: 'p4', unit: 'kilo', qty: 10 }]) })).data.order;
    const before = await stockOf(admin, 'p4');
    const res = await api('POST', `/orders/${placed.id}/cancel`, { token: juan });
    assert.equal(res.status, 200);
    assert.equal(res.data.order.status, 'cancelled');
    assert.equal(await stockOf(admin, 'p4'), before + 10);
    assert.equal((await api('POST', `/orders/${placed.id}/cancel`, { token: juan })).status, 409);
    const history = (await api('GET', '/products/p4/movements', { token: admin })).data.movements;
    assert.equal(history[0].type, 'return');
    assert.equal(history[0].ref, placed.id);
  });

  test('admin moves an order to delivered; cash becomes paid; rider is assigned', async () => {
    const placed = (await api('POST', '/orders', { token: juan, body: order([{ productId: 'p1', unit: 'kilo', qty: 2 }]) })).data.order;
    assert.equal((await api('POST', `/orders/${placed.id}/advance`, { token: juan })).status, 403);

    const steps = [];
    let current = placed;
    for (let i = 0; i < 4; i += 1) {
      current = (await api('POST', `/orders/${placed.id}/advance`, { token: admin })).data.order;
      steps.push(current.status);
      if (current.status === 'out_for_delivery') {
        assert.equal(current.rider.name, 'Ben Torres');
        assert.equal((await api('POST', `/orders/${placed.id}/cancel`, { token: admin })).status, 409);
      }
    }
    assert.deepEqual(steps, ['confirmed', 'preparing', 'out_for_delivery', 'delivered']);
    assert.equal(current.paymentStatus, 'paid');
    assert.equal(current.statusHistory.length, 5);
    assert.equal((await api('POST', `/orders/${placed.id}/advance`, { token: admin })).status, 409);
  });

  test('admin verifies a digital payment; refund on cancel', async () => {
    const placed = (
      await api('POST', '/orders', { token: maria, body: order([{ productId: 'p6', unit: 'half', qty: 1 }], { paymentMethod: 'maya', paymentRef: 'MY1' }) })
    ).data.order;
    const paid = (await api('POST', `/orders/${placed.id}/mark-paid`, { token: admin })).data.order;
    assert.equal(paid.paymentStatus, 'paid');
    const rider = (await api('PUT', `/orders/${placed.id}/rider`, { token: admin, body: { rider: { name: 'Jomar Aquino', phone: '0920', vehicle: 'Multicab' } } })).data.order;
    assert.equal(rider.rider.name, 'Jomar Aquino');
    const cancelled = (await api('POST', `/orders/${placed.id}/cancel`, { token: admin })).data.order;
    assert.equal(cancelled.paymentStatus, 'refunded');
  });
});

describe('inventory and suppliers', () => {
  test('stock adjustments cannot go below zero', async () => {
    const stock = await stockOf(admin, 'p8');
    const res = await api('POST', '/products/p8/stock-adjustments', { token: admin, body: { kgChange: -(stock + 1), note: 'Count' } });
    assert.equal(res.status, 409);
    const ok = await api('POST', '/products/p8/stock-adjustments', { token: admin, body: { kgChange: -2.5, note: 'Spilled' } });
    assert.equal(ok.data.product.stockKg, stock - 2.5);
  });

  test('receiving a purchase order adds stock and updates the cost', async () => {
    const created = await api('POST', '/purchase-orders', {
      token: admin,
      body: { supplierId: 's4', items: [{ productId: 'p9', sacks: 4, costPerKg: 78 }], expectedAt: tomorrow(), notes: 'Test' },
    });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    const po = created.data.purchaseOrder;
    assert.equal(po.totalKg, 200);
    assert.equal(po.totalCost, 15600);
    assert.equal(po.status, 'ordered');

    const before = await stockOf(admin, 'p9');
    const received = await api('POST', `/purchase-orders/${po.id}/receive`, { token: admin });
    assert.equal(received.data.purchaseOrder.status, 'received');
    const product = (await api('GET', '/products/p9', { token: admin })).data.product;
    assert.equal(product.stockKg, before + 200);
    assert.equal(product.costPerKg, 78);
    assert.equal((await api('POST', `/purchase-orders/${po.id}/receive`, { token: admin })).status, 409);
    assert.equal((await api('POST', `/purchase-orders/${po.id}/cancel`, { token: admin })).status, 409);
  });

  test('adds and edits a supplier', async () => {
    const res = await api('POST', '/suppliers', { token: admin, body: { name: 'Bulacan Grains', varietyIds: ['p1'] } });
    assert.equal(res.status, 201);
    assert.equal(res.data.supplier.leadTimeDays, 3);
    const edited = await api('PATCH', `/suppliers/${res.data.supplier.id}`, { token: admin, body: { leadTimeDays: 1, varietyIds: ['p1', 'p6'] } });
    assert.deepEqual(edited.data.supplier.varietyIds, ['p1', 'p6']);
    assert.equal((await api('POST', '/suppliers', { token: admin, body: { name: 'X', varietyIds: ['nope'] } })).status, 400);
  });
});

describe('wholesale, pricing and reports', () => {
  test('wholesale application and approval change the price channel', async () => {
    const token = await login('mark@email.com', '123456');
    const cart = { items: [{ productId: 'p6', unit: 'sack', qty: 1 }], fulfillment: 'pickup' };
    assert.equal((await api('POST', '/orders/quote', { token, body: cart })).data.quote.channel, 'retail');

    const applied = await api('POST', '/me/wholesale-application', { token, body: { businessName: 'Mark Rice Store' } });
    assert.equal(applied.data.user.wholesaleStatus, 'pending');
    const pending = (await api('GET', '/customers?wholesaleStatus=pending', { token: admin })).data.customers;
    assert.ok(pending.some((c) => c.id === 'u8'));

    await api('PATCH', '/customers/u8', { token: admin, body: { wholesaleStatus: 'approved' } });
    const quote = (await api('POST', '/orders/quote', { token, body: cart })).data.quote;
    assert.equal(quote.channel, 'wholesale');
    assert.equal(quote.items[0].pricePerKg, 42);

    const removed = await api('PATCH', '/customers/u8', { token: admin, body: { wholesaleStatus: null } });
    assert.equal(removed.data.customer.accountType, 'retail');
  });

  test('discount rules: customers see active ones; admin manages them', async () => {
    const customerRules = (await api('GET', '/pricing-rules', { token: juan })).data.rules;
    assert.ok(customerRules.every((r) => r.active));
    assert.equal((await api('POST', '/pricing-rules', { token: admin, body: { name: 'Bad', minKg: 10, type: 'percent', value: 150 } })).status, 400);
    const rule = (await api('POST', '/pricing-rules', { token: admin, body: { name: 'Promo', minKg: 10, type: 'perKg', value: 2 } })).data.rule;
    assert.equal(rule.appliesTo, 'all');
    assert.equal((await api('PATCH', `/pricing-rules/${rule.id}`, { token: admin, body: { active: false } })).data.rule.active, false);
    assert.equal((await api('DELETE', `/pricing-rules/${rule.id}`, { token: admin })).status, 204);
  });

  test('settings: delivery fee changes apply to new quotes', async () => {
    await api('PATCH', '/settings', { token: admin, body: { deliveryFee: 100, store: { hours: 'Daily, 7 AM – 7 PM' } } });
    const store = (await api('GET', '/store')).data;
    assert.equal(store.settings.deliveryFee, 100);
    assert.equal(store.store.hours, 'Daily, 7 AM – 7 PM');
    assert.equal(store.store.name, 'Bugasan ni Ali');
    const quote = (await api('POST', '/orders/quote', { token: juan, body: { items: [{ productId: 'p1', unit: 'kilo', qty: 1 }], fulfillment: 'delivery' } })).data.quote;
    assert.equal(quote.deliveryFee, 100);
  });

  test('every report answers for the admin only', async () => {
    for (const name of ['sales', 'inventory', 'best-sellers', 'channels', 'supplier-purchases']) {
      const res = await api('GET', `/reports/${name}?days=90`, { token: admin });
      assert.equal(res.status, 200, name);
      assert.equal(res.data.days, 90);
    }
    const sales = (await api('GET', '/reports/sales?days=7', { token: admin })).data;
    assert.equal(sales.series.length, 7);
    assert.ok(sales.summary.total > 0);
    assert.equal((await api('GET', '/reports/sales?days=0', { token: admin })).status, 400);
    assert.equal((await api('GET', '/reports/dashboard', { token: juan })).status, 403);
  });
});
