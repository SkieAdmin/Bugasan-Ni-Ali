# Bugasan ni Ali — Mobile App (Frontend)

**Rice Ordering, Retail/Wholesale Sales, and Inventory Management System**
by Joshua Perlas

A React Native (Expo) mobile app where households, small businesses and resellers order rice
by kilo, half-sack, sack or bulk, for pickup or delivery, while the store manages inventory,
suppliers, purchase orders, pricing, customer orders, payments and deliveries.

> All data comes from the Node.js backend in `../backend` (live at **https://perlas.ccshub.uk/api**).
> The chip at the top-left of every screen shows whether the app can reach it: **Connected** or **Offline**
> (tap it to check again).

## How to run

Requirements: Node.js 20+ and the **Expo Go** app on your phone (it must support Expo SDK 57).

```bash
cd frontend
npm install
npx expo start
```

- **Phone:** scan the QR code with Expo Go (Android) or the Camera app (iPhone).
- **Browser:** press `w` in the terminal to open the web version.

The app talks to `https://perlas.ccshub.uk/api` by default. To use a backend running on your computer
instead, start Expo with your computer's Wi-Fi IP (or put the variable in `frontend/.env.local`):

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000/api npx expo start
```

## Accounts

Log in with an account from the backend, or create one with *Create an account*. If the backend was
loaded with its demo data (`npm run seed` in `../backend`), these exist:

| Role | Email | Password | What to try |
|---|---|---|---|
| Customer (retail) | `juan@email.com` | `123456` | Shop, cart, checkout, track orders, receipt |
| Customer (wholesale) | `maria@email.com` | `123456` | Wholesale prices on half-sack / sack / bulk |
| Store Admin | `admin@bugasan.ph` | `admin123` | Dashboard, orders, inventory, suppliers, reports |

Choosing **Business / Reseller** when registering makes a wholesale application,
which the admin approves in **More → Wholesale Customers**.

## Where each feature is

| # | Feature | Where to find it |
|---|---|---|
| 1 | Customer registration and login | Login screen → *Create an account* |
| 2 | Rice variety and product catalog | Customer **Shop** tab (search + categories). Admin can add varieties in **Inventory → +** |
| 3 | Retail and wholesale pricing | **Rice Details** shows both prices. Admin edits them in **More → Pricing & Discounts → Price List** |
| 4 | Order by kilo, half-sack, sack, or bulk | **Rice Details → "How do you want to buy?"** (1 kg / 25 kg / 50 kg / 500 kg) |
| 5 | Shopping cart and checkout | **Cart** tab → **Checkout** |
| 6 | Cash or digital payment | Checkout → Cash, GCash, Maya or Bank Transfer (digital needs a reference no.) |
| 7 | Pickup or delivery option | Checkout → *Deliver to me* / *Pick up at the store* |
| 8 | Delivery scheduling and status tracking | Checkout date & time slot. **My Orders → order** shows the status timeline and rider |
| 9 | Digital receipt | Order status → **View Digital Receipt** (can be shared) |
| 10 | Customer order history | **My Orders** tab (Active / Completed / Cancelled) + *Buy Again* |
| 11 | Rice inventory monitoring | Admin **Inventory** tab (stock in kg and sacks, reorder levels) |
| 12 | Automatic stock deduction after sales | Placing an order deducts stock right away; cancelling returns it. See **Inventory → variety → Stock movement history** |
| 13 | Supplier and restocking management | **More → Suppliers** (add supplier, varieties, purchase history) |
| 14 | Purchase order recording | **More → Purchase Orders** → new PO → *Mark as Received* adds the stock |
| 15 | Low-stock alerts | Dashboard alert list, Inventory badges and the tab badge count |
| 16 | Wholesale customer management | **More → Wholesale Customers** (approve, decline, remove) |
| 17 | Discount and bulk-pricing rules | **More → Pricing & Discounts → Discounts** (e.g. 2% off 100 kg+, 5% off 500 kg+) |
| 18 | Sales and inventory reports | **Reports → Sales** and **Reports → Inventory** (7 / 30 / 90 days) |
| 19 | Best-selling rice variety report | **Reports → Best Sellers** |
| 20 | Retail vs. wholesale sales report | **Reports → Retail vs Wholesale** |
| 21 | Supplier purchase report | **Reports → Supplier Purchases** |

Admins also manage each order in **Orders → order**: move it through
*Pending → Confirmed → Preparing → Out for Delivery / Ready for Pickup → Delivered / Picked Up*,
assign a rider, verify digital payments or record cash, and cancel orders.

## Project structure

```
frontend/
├── app.json                  App name, icons, Expo config
└── src/
    ├── app/                  Screens (Expo Router — every file is a route)
    │   ├── (auth)/           login, register
    │   ├── (customer)/       shop, cart, orders, profile, product, checkout, order status, receipt
    │   └── admin/            dashboard, orders, inventory, reports, more, suppliers,
    │                         purchase orders, wholesale customers, pricing
    ├── api/                  Backend address (config.js), HTTP client, saved login
    ├── components/           Reusable UI (buttons, cards, charts, receipt, network status…)
    ├── context/AppContext.js App state + every action (login, placeOrder, receivePurchaseOrder…)
    ├── hooks/                Small shared hooks (useBusy, useApiData…)
    ├── screens/              Screens shared by customer and admin (receipt)
    ├── theme/                Colors, spacing, fonts
    └── utils/                Pricing rules, order statuses, formatting, report calculations
```

## How the app uses the backend

- `src/api/client.js` sends every request with the login token and turns server errors into messages for the user.
- `src/context/AppContext.js` loads what the logged-in user needs (catalog, orders, and for the admin also
  suppliers, purchase orders and customers) and keeps it fresh: every 30 seconds, when you pull a screen down,
  when the connection comes back, and after every change. Actions like `placeOrder` call the API and resolve to
  `{ ok, error }`; failed actions show an error message.
- The server computes the final price of every order and deducts the stock; the cart and checkout show the
  same calculation beforehand (`src/utils/pricing.js`).
- The Reports tab and each variety's stock history come from the report endpoints, so they cover every order.
- The login is saved on the device, so the app stays logged in after it is closed.

The full list of endpoints is in `../backend/README.md`.
