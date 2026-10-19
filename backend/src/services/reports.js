// Admin reports and dashboard. Loads the data for the period and runs the same
// calculations the app uses (src/lib/reports.js).
import { db } from '../db/index.js';
import { isSameDay } from '../lib/format.js';
import { stockStatus } from '../lib/pricing.js';
import {
  bestSellers,
  channelSplit,
  inventorySummary,
  movementSummary,
  paymentSplit,
  periodStart,
  reportText,
  salesOrders,
  salesSeries,
  salesSummary,
  supplierPurchases,
} from '../lib/reports.js';
import { listOrders } from './orders.js';
import { listMovements, listProducts } from './products.js';
import { listPurchaseOrders } from './purchaseOrders.js';
import { listSuppliers } from './suppliers.js';

const since = (days) => periodStart(days).toISOString();

export function salesReport(days) {
  const orders = listOrders({ since: since(days) });
  const sales = salesOrders(orders, days);
  return {
    days,
    summary: salesSummary(sales),
    series: salesSeries(sales, days),
    payments: paymentSplit(sales),
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  };
}

export function inventoryReport(days) {
  const products = listProducts();
  return {
    days,
    summary: inventorySummary(products),
    movements: movementSummary(listMovements({ since: since(days), limit: -1 }), days),
    products: products
      .filter((p) => p.active)
      .sort((a, b) => b.stockKg - a.stockKg)
      .map((p) => ({ ...p, stockStatus: stockStatus(p) })),
  };
}

export function bestSellersReport(days) {
  return { days, list: bestSellers(salesOrders(listOrders({ since: since(days) }), days), listProducts()) };
}

export function channelReport(days) {
  return { days, ...channelSplit(salesOrders(listOrders({ since: since(days) }), days)) };
}

export function supplierReport(days) {
  return { days, ...supplierPurchases(listPurchaseOrders({ since: since(days) }), listSuppliers(), days) };
}

// Plain-text summary for the Share button on the Reports screen.
export function shareText(days) {
  const state = {
    orders: listOrders({ since: since(days) }),
    products: listProducts(),
    purchaseOrders: listPurchaseOrders({ since: since(days) }),
    suppliers: listSuppliers(),
  };
  return reportText(state, days);
}

// Everything the admin home screen shows.
export function dashboard() {
  const today = new Date();
  const weekOrders = listOrders({ since: since(7) });
  const todaysOrders = weekOrders.filter((o) => o.status !== 'cancelled' && isSameDay(o.createdAt, today));
  const count = (sql) => db.prepare(sql).pluck().get();

  return {
    today: { sales: todaysOrders.reduce((s, o) => s + o.total, 0), orders: todaysOrders.length },
    pendingOrders: count("SELECT COUNT(*) FROM orders WHERE status = 'pending'"),
    paymentsToVerify: count("SELECT COUNT(*) FROM orders WHERE payment_status = 'for_verification' AND status != 'cancelled'"),
    pendingWholesale: count("SELECT COUNT(*) FROM users WHERE wholesale_status = 'pending'"),
    openPurchaseOrders: count("SELECT COUNT(*) FROM purchase_orders WHERE status = 'ordered'"),
    stockAlerts: listProducts()
      .filter((p) => p.active && stockStatus(p) !== 'ok')
      .sort((a, b) => a.stockKg / (a.reorderLevel || 1) - b.stockKg / (b.reorderLevel || 1))
      .map((p) => ({ ...p, stockStatus: stockStatus(p) })),
    week: salesSeries(salesOrders(weekOrders, 7), 7),
    recentOrders: listOrders({ limit: 4 }),
  };
}
