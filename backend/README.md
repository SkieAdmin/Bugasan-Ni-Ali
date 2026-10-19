# Bugasan ni Ali — Backend API

Node.js + Express API for the **Bugasan ni Ali** rice ordering app (`../frontend`).
Data is stored in SQLite (one file, no database server to install). It will be hosted at
**https://perlas.ccshub.uk/api**.

The server is the source of truth: it computes every price and discount, deducts stock when an
order is placed (and returns it on cancel), numbers orders and purchase orders, and builds the reports.
Stock changes run in database transactions, so an order never deducts only part of its rice.

## Run it on your computer

Requirements: Node.js 22 or newer.

```bash
cd backend
npm install
cp .env.example .env      # then set JWT_SECRET; use HOST=0.0.0.0 and NODE_ENV=development for phone testing
npm run seed              # loads the demo rice varieties, accounts and 5 weeks of orders
npm run dev               # http://localhost:3000/api/health
```

To use it from the app, start Expo with your computer's Wi-Fi IP:

```bash
cd frontend
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000/api npx expo start
```

| Script | What it does |
|---|---|
| `npm start` | Start the API |
| `npm run dev` | Start and restart on file changes |
| `npm run seed` | Load the demo data into an empty database (`-- --force` wipes an existing one) |
| `npm run set-password -- <email> <password>` | Change any account's password from the server |
| `npm test` | API tests on a temporary in-memory database |

Demo logins after seeding: `admin@bugasan.ph` / `admin123`, `juan@email.com` / `123456` (retail),
`maria@email.com` / `123456` (wholesale). **These passwords are public.** On the live server, change
them (`npm run set-password`) or skip the seed and register real accounts.

## API

Every response is JSON. Errors look like `{ "error": "Message to show", "fields": { "email": "..." } }`
with status 400 (bad input), 401 (not logged in), 403 (not allowed), 404, 409 (conflict, e.g. not enough stock).
Logged-in requests send `Authorization: Bearer <token>`.

**Public**

| Method & path | |
|---|---|
| `GET /api/health` | `{ status: "ok" }`, used by the app's network status chip |
| `GET /api/store` | Store info, rice categories, delivery fees, units, payment methods, time slots |
| `POST /api/auth/register` | `{ name, email, password, phone, address, accountType, businessName }` → `{ token, user }` |
| `POST /api/auth/login` | `{ email, password }` → `{ token, user }` (20 tries / 15 min per visitor) |

**Any logged-in user**

| Method & path | |
|---|---|
| `GET /api/me` · `PATCH /api/me` | Own account; change `name`, `phone`, `address` |
| `POST /api/me/password` | `{ currentPassword, newPassword }` → new token (old ones stop working) |
| `POST /api/me/wholesale-application` | `{ businessName }` |
| `GET /api/products` · `GET /api/products/:id` | Catalog (customers don't see cost prices or inactive varieties) |
| `GET /api/pricing-rules` | Discount rules (customers get the active ones) |
| `GET /api/orders` | Customers: their own orders. Admin: all (`?status=&customerId=&limit=&offset=`) |
| `POST /api/orders/quote` | `{ items, fulfillment }` → prices without saving |
| `POST /api/orders` | Place an order (customers): `{ items: [{ productId, unit, qty }], fulfillment, address, schedule: { date, slot }, paymentMethod, paymentRef, notes }` |
| `GET /api/orders/:id` | One order |
| `POST /api/orders/:id/cancel` | Customers: while pending. Admin: until it is out for delivery. Stock is returned |

**Admin only**

| Method & path | |
|---|---|
| `POST /api/orders/:id/advance` | Next status (cash orders become paid on delivery / pickup) |
| `PUT /api/orders/:id/rider` | `{ rider: { name, phone, vehicle } }` |
| `POST /api/orders/:id/mark-paid` | Verify a digital payment / record cash |
| `POST /api/products` · `PATCH /api/products/:id` | Add / edit a variety (stock is not edited directly) |
| `POST /api/products/:id/stock-adjustments` | `{ kgChange, note }`, e.g. `-12` for a damaged sack |
| `GET /api/products/:id/movements` | Stock movement history + kilos sold in 30 days |
| `GET/POST /api/suppliers` · `GET/PATCH /api/suppliers/:id` | Suppliers and the varieties they sell |
| `GET/POST /api/purchase-orders` · `GET /api/purchase-orders/:id` | Purchase orders (`?supplierId=&status=`) |
| `POST /api/purchase-orders/:id/receive` · `/cancel` | Receiving adds the stock and updates the cost price |
| `GET /api/customers` · `GET /api/customers/:id` | Customers with purchase totals (`?wholesaleStatus=pending`) |
| `PATCH /api/customers/:id` | `{ wholesaleStatus: "approved" }` or `{ wholesaleStatus: null }` |
| `POST/PATCH/DELETE /api/pricing-rules[/:id]` | Manage discount rules |
| `GET/PATCH /api/settings` | Delivery fee, free-delivery minimum, store info, riders, categories |
| `GET /api/reports/dashboard` | Today's sales, pending counts, stock alerts, last 7 days |
| `GET /api/reports/{sales,inventory,best-sellers,channels,supplier-purchases}?days=30` | Reports |
| `GET /api/reports/share?days=30` | Plain-text summary for sharing |

## Deploy to perlas.ccshub.uk

On an Ubuntu server with Node.js 22+ and nginx:

```bash
# 1. Code and settings
cd /var/www && git clone <repo> bugasan && cd bugasan/backend
npm ci --omit=dev
cp .env.example .env && nano .env            # set JWT_SECRET (see the command in the file)
npm run seed                                 # optional: demo data, then change the demo passwords

# 2. Keep it running (restarts on crash and on reboot)
sudo npm install -g pm2
pm2 start npm --name bugasan-api -- start
pm2 save && pm2 startup                      # run the command it prints

# 3. nginx
sudo cp deploy/nginx/perlas.ccshub.uk.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/perlas.ccshub.uk.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

In **Cloudflare**: add an `A` record `perlas` → your server IP (proxied, orange cloud), set
**SSL/TLS → Flexible**, and turn on **Always Use HTTPS**. Then `https://perlas.ccshub.uk/api/health`
should answer `{"status":"ok"}` and the app's chip shows **Connected**.

Backups: the whole database is `data/bugasan.db`. Copy it with `sqlite3 data/bugasan.db ".backup backup.db"`
(safe while the API is running).

## Project structure

```
backend/
├── src/
│   ├── server.js            Starts the API
│   ├── app.js               Express app: security headers, CORS, rate limits, routes
│   ├── config.js            Settings from .env
│   ├── db/                  SQLite connection, schema.sql, demo data, seed / set-password scripts
│   ├── lib/                 Pricing rules, order statuses, report calculations (same as the app's utils)
│   ├── middleware/          Login check (JWT), admin check, error responses
│   ├── routes/              One file per area; validates the input with zod
│   └── services/            Database queries and business rules
├── test/api.test.js         End-to-end API tests
└── deploy/nginx/            nginx site for perlas.ccshub.uk (Cloudflare Flexible SSL)
```
