-- Database tables for Bugasan ni Ali. Runs on every start; IF NOT EXISTS keeps existing data.
-- Dates are ISO strings in UTC (e.g. 2026-10-19T01:30:00.000Z). Weights are in kilos, money in pesos.

CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY,
  role             TEXT NOT NULL CHECK (role IN ('admin', 'customer')),
  name             TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash    TEXT NOT NULL,
  token_version    INTEGER NOT NULL DEFAULT 0,  -- bumped on password change to log out old sessions
  phone            TEXT NOT NULL DEFAULT '',
  address          TEXT NOT NULL DEFAULT '',
  account_type     TEXT NOT NULL DEFAULT 'retail' CHECK (account_type IN ('retail', 'wholesale')),
  wholesale_status TEXT CHECK (wholesale_status IN ('pending', 'approved')),
  business_name    TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  contact_person TEXT NOT NULL DEFAULT '',
  phone          TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL DEFAULT '',
  address        TEXT NOT NULL DEFAULT '',
  lead_time_days INTEGER NOT NULL DEFAULT 3
);

-- Rice varieties. Never deleted (old orders point to them); set active = 0 to hide one.
CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  origin          TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  retail_price    REAL NOT NULL,
  wholesale_price REAL NOT NULL,
  cost_per_kg     REAL NOT NULL DEFAULT 0,
  stock_kg        REAL NOT NULL DEFAULT 0 CHECK (stock_kg >= 0),
  reorder_level   REAL NOT NULL DEFAULT 0,
  supplier_id     TEXT REFERENCES suppliers (id) ON DELETE SET NULL,
  tint            TEXT NOT NULL DEFAULT '#B7862B',
  active          INTEGER NOT NULL DEFAULT 1
);

-- Which varieties each supplier sells.
CREATE TABLE IF NOT EXISTS supplier_varieties (
  supplier_id TEXT NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  PRIMARY KEY (supplier_id, product_id)
);

CREATE TABLE IF NOT EXISTS pricing_rules (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  min_kg     REAL NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('percent', 'perKg')),
  value      REAL NOT NULL,
  applies_to TEXT NOT NULL CHECK (applies_to IN ('all', 'retail', 'wholesale')),
  active     INTEGER NOT NULL DEFAULT 1
);

-- Key/value store settings (delivery fee, store info, riders, categories). Values are JSON.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id             TEXT PRIMARY KEY,               -- BNA-10001
  order_no       INTEGER NOT NULL UNIQUE,
  receipt_no     TEXT NOT NULL UNIQUE,           -- OR-010001
  customer_id    TEXT NOT NULL REFERENCES users (id),
  customer_name  TEXT NOT NULL,
  contact_name   TEXT NOT NULL,
  customer_phone TEXT NOT NULL DEFAULT '',
  channel        TEXT NOT NULL CHECK (channel IN ('retail', 'wholesale')),
  subtotal       REAL NOT NULL,
  discount       REAL NOT NULL,
  delivery_fee   REAL NOT NULL,
  total          REAL NOT NULL,
  total_kg       REAL NOT NULL,
  fulfillment    TEXT NOT NULL CHECK (fulfillment IN ('delivery', 'pickup')),
  address        TEXT NOT NULL,
  schedule_date  TEXT NOT NULL,
  schedule_slot  TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_ref    TEXT NOT NULL DEFAULT '',
  payment_status TEXT NOT NULL,
  status         TEXT NOT NULL,
  status_history TEXT NOT NULL DEFAULT '[]',     -- JSON: [{ status, at }]
  rider          TEXT,                           -- JSON: { name, phone, vehicle }
  notes          TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_created_at ON orders (created_at);
CREATE INDEX IF NOT EXISTS orders_customer ON orders (customer_id, created_at);
CREATE INDEX IF NOT EXISTS orders_status ON orders (status);

-- Each line keeps the name and price at the time of the sale, so receipts never change.
CREATE TABLE IF NOT EXISTS order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id   TEXT NOT NULL REFERENCES products (id),
  name         TEXT NOT NULL,
  unit         TEXT NOT NULL CHECK (unit IN ('kilo', 'half', 'sack', 'bulk')),
  qty          INTEGER NOT NULL,
  kg           REAL NOT NULL,
  price_per_kg REAL NOT NULL,
  price_type   TEXT NOT NULL CHECK (price_type IN ('retail', 'wholesale')),
  subtotal     REAL NOT NULL,
  discount     REAL NOT NULL,
  rule_name    TEXT,
  total        REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS order_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_product ON order_items (product_id);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id            TEXT PRIMARY KEY,                -- PO-1001
  po_no         INTEGER NOT NULL UNIQUE,
  supplier_id   TEXT NOT NULL REFERENCES suppliers (id),
  supplier_name TEXT NOT NULL,
  total_kg      REAL NOT NULL,
  total_cost    REAL NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('ordered', 'received', 'cancelled')),
  ordered_at    TEXT NOT NULL,
  expected_at   TEXT,
  received_at   TEXT,
  notes         TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS purchase_orders_ordered_at ON purchase_orders (ordered_at);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id       TEXT NOT NULL REFERENCES purchase_orders (id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products (id),
  name        TEXT NOT NULL,
  sacks       INTEGER NOT NULL,
  kg          REAL NOT NULL,
  cost_per_kg REAL NOT NULL,
  total       REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS purchase_order_items_po ON purchase_order_items (po_id);

-- Every change to stock: sale (-), return (+), restock (+) or manual adjustment (+/-).
CREATE TABLE IF NOT EXISTS stock_movements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('sale', 'return', 'restock', 'adjustment')),
  kg         REAL NOT NULL,
  ref        TEXT NOT NULL DEFAULT '',           -- order id, PO id, ADJ or NEW
  note       TEXT NOT NULL DEFAULT '',
  at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS stock_movements_product ON stock_movements (product_id, at);
CREATE INDEX IF NOT EXISTS stock_movements_at ON stock_movements (at);
