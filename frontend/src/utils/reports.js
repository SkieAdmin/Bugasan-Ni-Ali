// Calculations for the admin reports. The backend will later return these from report endpoints.
import { addDays, formatDate, formatShortDate, isSameDay, kg, peso, startOfDay } from './format';
import { stockStatus } from './pricing';
import { PAYMENT_METHODS } from './orders';

export function periodStart(days) {
  return startOfDay(addDays(new Date(), -(days - 1)));
}

export function inPeriod(dateValue, days) {
  return new Date(dateValue) >= periodStart(days);
}

// Sales = every order that was not cancelled (stock is deducted when the order is placed).
export function salesOrders(orders, days) {
  return orders.filter((o) => o.status !== 'cancelled' && inPeriod(o.createdAt, days));
}

export function salesSummary(orders) {
  const total = orders.reduce((s, o) => s + o.total, 0);
  const totalKg = orders.reduce((s, o) => s + o.totalKg, 0);
  return {
    total,
    count: orders.length,
    average: orders.length ? total / orders.length : 0,
    kg: totalKg,
    discounts: orders.reduce((s, o) => s + o.discount, 0),
  };
}

// Daily buckets for 7 / 30 days, weekly buckets for longer periods.
export function salesSeries(orders, days) {
  const start = periodStart(days);
  if (days <= 31) {
    return Array.from({ length: days }, (_, i) => {
      const day = addDays(start, i);
      const value = orders.filter((o) => isSameDay(o.createdAt, day)).reduce((s, o) => s + o.total, 0);
      return { key: day.toISOString(), label: formatShortDate(day), longLabel: formatDate(day), value };
    });
  }
  const weeks = Math.ceil(days / 7);
  return Array.from({ length: weeks }, (_, i) => {
    const from = addDays(start, i * 7);
    const to = addDays(from, 7);
    const value = orders
      .filter((o) => new Date(o.createdAt) >= from && new Date(o.createdAt) < to)
      .reduce((s, o) => s + o.total, 0);
    return { key: from.toISOString(), label: formatShortDate(from), longLabel: `Week of ${formatDate(from)}`, value };
  });
}

export function bestSellers(orders, products) {
  const map = {};
  orders.forEach((o) =>
    o.items.forEach((item) => {
      if (!map[item.productId]) map[item.productId] = { productId: item.productId, kg: 0, revenue: 0, orders: new Set() };
      map[item.productId].kg += item.kg;
      map[item.productId].revenue += item.total;
      map[item.productId].orders.add(o.id);
    })
  );
  return Object.values(map)
    .map((x) => ({
      ...x,
      orders: x.orders.size,
      product: products.find((p) => p.id === x.productId),
    }))
    .filter((x) => x.product)
    .sort((a, b) => b.kg - a.kg);
}

export function channelSplit(orders) {
  const make = (channel) => {
    const list = orders.filter((o) => o.channel === channel);
    return {
      count: list.length,
      revenue: list.reduce((s, o) => s + o.total, 0),
      kg: list.reduce((s, o) => s + o.totalKg, 0),
      average: list.length ? list.reduce((s, o) => s + o.total, 0) / list.length : 0,
    };
  };
  return { retail: make('retail'), wholesale: make('wholesale') };
}

export function paymentSplit(orders) {
  return Object.keys(PAYMENT_METHODS).map((key) => {
    const list = orders.filter((o) => o.paymentMethod === key);
    return { key, label: PAYMENT_METHODS[key].label, count: list.length, revenue: list.reduce((s, o) => s + o.total, 0) };
  });
}

export function inventorySummary(products) {
  const active = products.filter((p) => p.active);
  return {
    totalKg: active.reduce((s, p) => s + p.stockKg, 0),
    value: active.reduce((s, p) => s + p.stockKg * p.costPerKg, 0),
    retailValue: active.reduce((s, p) => s + p.stockKg * p.retailPrice, 0),
    low: active.filter((p) => stockStatus(p) === 'low').length,
    out: active.filter((p) => stockStatus(p) === 'out').length,
  };
}

export function movementSummary(movements, days) {
  const list = movements.filter((m) => inPeriod(m.at, days));
  const sum = (type) => list.filter((m) => m.type === type).reduce((s, m) => s + m.kg, 0);
  return { sold: -sum('sale'), restocked: sum('restock'), returned: sum('return'), adjusted: sum('adjustment') };
}

export function supplierPurchases(purchaseOrders, suppliers, days) {
  const list = purchaseOrders.filter((po) => po.status !== 'cancelled' && inPeriod(po.orderedAt, days));
  const rows = suppliers
    .map((s) => {
      const mine = list.filter((po) => po.supplierId === s.id);
      return {
        supplier: s,
        count: mine.length,
        cost: mine.reduce((sum, po) => sum + po.totalCost, 0),
        kg: mine.reduce((sum, po) => sum + po.totalKg, 0),
        pending: mine.filter((po) => po.status === 'ordered').length,
      };
    })
    .sort((a, b) => b.cost - a.cost);
  return {
    rows,
    list,
    totalCost: list.reduce((s, po) => s + po.totalCost, 0),
    totalKg: list.reduce((s, po) => s + po.totalKg, 0),
    pending: list.filter((po) => po.status === 'ordered').length,
  };
}

export function reportText(state, days) {
  const sales = salesOrders(state.orders, days);
  const summary = salesSummary(sales);
  const split = channelSplit(sales);
  const top = bestSellers(sales, state.products).slice(0, 3);
  const inv = inventorySummary(state.products);
  const purchases = supplierPurchases(state.purchaseOrders, state.suppliers, days);
  return [
    `BUGASAN NI ALI — Report (last ${days} days)`,
    `Generated ${formatDate(new Date())}`,
    '',
    `Sales: ${peso(summary.total)} from ${summary.count} orders (${kg(summary.kg)})`,
    `Retail: ${peso(split.retail.revenue)} · Wholesale: ${peso(split.wholesale.revenue)}`,
    `Best sellers: ${top.map((t, i) => `${i + 1}. ${t.product.name} (${kg(t.kg)})`).join(', ')}`,
    `Stock on hand: ${kg(inv.totalKg)} worth ${peso(inv.value)} (cost)`,
    `Low stock: ${inv.low} · Out of stock: ${inv.out}`,
    `Supplier purchases: ${peso(purchases.totalCost)} (${kg(purchases.totalKg)})`,
  ].join('\n');
}
