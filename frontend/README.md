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

## Notifications

The phone gets a notification for every order update (customers) and for new orders, cancellations,
wholesale applications and low stock (admin). It works in one of two ways, chosen automatically:

- **Real push** — the backend sends through Expo and Firebase, and the phone gets it instantly even
  when the app is closed. Needs a build with an EAS project id and Firebase:
  1. `npx eas login` then `npx eas init` in `frontend/` (writes `extra.eas.projectId` into `app.json`).
  2. In the [Firebase console](https://console.firebase.google.com) add an Android app with the package
     `uk.ccshub.perlas.bugasanniali` and put its `google-services.json` in `frontend/`
     (`app.config.js` adds it to the build when the file is there).
  3. Firebase → Project settings → Service accounts → *Generate new private key*, then upload that file
     with `npx eas credentials` → Android → *Google Service Account* → *FCM V1*.
  4. Rebuild the APK. "Send a test notification" on the Profile / More tab confirms it works.
- **Made on the phone** — any build without the above. The app compares each sync with what it saw last
  and shows the same notification the backend would have pushed (`src/notifications/alerts.js`): every
  10 seconds while the app is open, for 10 minutes after it is put away, then from a background task
  that Android runs about every 15 minutes (`src/notifications/backgroundCheck.js`).

Turning notifications off in the app is remembered across restarts.

### Building the APK

```bash
cd frontend
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a
# -> android/app/build/outputs/apk/release/app-release.apk (ARM phones only: ~57 MB instead of ~99 MB)
```

Raise `version` and `android.versionCode` in `app.json` for every APK you hand out, so it installs as an
update over the previous one.

**On Windows, build from a short folder** (e.g. a copy of `frontend/` at `C:\bna`). From this repo's
folder the native build fails with `ninja: error: manifest 'build.ninja' still dirty after 100 tries`:
some paths inside `node_modules/*/android/.cxx` pass Windows' 260-character limit, which the `ninja`
bundled with the Android SDK's CMake 3.22.1 cannot read.
