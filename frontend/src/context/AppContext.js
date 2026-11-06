// Global app state + all actions (login, cart, orders, inventory, suppliers, pricing).
//
// The data comes from the backend API (src/api). After login the app loads what the user needs
// into `state` (same shape as the old mock data, so screens read it the same way) and keeps it
// fresh: every 30 seconds, on pull-to-refresh, when the connection comes back, and after changes.
//
// Actions that change data are async and resolve to { ok: true, ...result } or { ok: false, error }.
// Failed actions show an error toast by default. The cart stays on the device until checkout.
//
// Notifications: with real push the backend reaches the phone directly. A build that cannot get
// push from the server makes the notifications itself (src/notifications/alerts.js): it looks
// for updates every few seconds while the app is open, for a while after it is put away, and
// then through a background task (src/notifications/backgroundCheck.js).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError, api, checkHealth, getAuthToken, onConnectionChange, onUnauthorized, setAuthToken } from '../api/client';
import { clearSession, loadSession, saveSession } from '../api/session';
import {
  forgetToken,
  getPushToken,
  loadPushMode,
  permissionStatus,
  savePushMode,
  saveToken,
  sendTestNotification,
  showLocalNotification,
  unsupportedReason,
} from '../api/push';
import { checkForUpdates, fetchUpdates, noteSeen, updatesFrom } from '../notifications/alerts';
import { startBackgroundChecks, stopBackgroundChecks } from '../notifications/backgroundCheck';
import { UNITS } from '../utils/pricing';

const AppContext = createContext(null);

const HEALTH_CHECK_MS = 15000;
const DATA_REFRESH_MS = 30000;

// When the phone makes its own notifications: how often it looks for updates while the app is
// open, and while it is put away - for a few minutes, then the background task takes over.
const WATCH_MS = 10000;
const WATCH_HIDDEN_MS = 30000;
const WATCH_HIDDEN_FOR_MS = 10 * 60 * 1000;

// Saves how this phone gets notifications (see src/api/push.js) and runs the background
// update checks only when the phone makes its own.
async function applyPushMode(mode) {
  await savePushMode(mode);
  if (mode === 'local') await startBackgroundChecks();
  else await stopBackgroundChecks();
}

// Shown until the server sends the real store info.
const FALLBACK_STORE = {
  name: 'Bugasan ni Ali',
  tagline: 'Rice Ordering · Retail & Wholesale',
  address: '',
  phone: '',
  hours: '',
  gcash: '',
  maya: '',
  bank: '',
};

const INITIAL = {
  ready: false, // the saved login on this device has been checked
  currentUser: null,
  store: FALLBACK_STORE,
  categories: [],
  riders: [],
  settings: { deliveryFee: 0, freeDeliveryMin: 0 },
  products: [],
  pricingRules: [],
  orders: [],
  suppliers: [],
  purchaseOrders: [],
  users: [],
  cart: [],
};

const replaceById = (list, item) => list.map((x) => (x.id === item.id ? { ...x, ...item } : x));

// GET /store (public) and GET /settings (admin) both carry the store info.
const fromStore = (s) => ({ store: s.store, categories: s.categories, settings: s.settings });
const fromSettings = (s) => ({
  store: s.store,
  categories: s.categories,
  riders: s.riders,
  settings: { deliveryFee: s.deliveryFee, freeDeliveryMin: s.freeDeliveryMin },
});

// Cart lines whose rice variety is no longer sold are dropped.
const cleanCart = (cart, products) => cart.filter((c) => products.some((p) => p.id === c.productId));

// Everything the screens of this kind of user need.
async function fetchData(user) {
  const common = Promise.all([api.get('/me'), api.get('/products'), api.get('/pricing-rules'), api.get('/orders?limit=500')]);

  if (user.role !== 'admin') {
    const [[me, products, rules, orders], store] = await Promise.all([common, api.get('/store')]);
    return { currentUser: me.user, products: products.products, pricingRules: rules.rules, orders: orders.orders, ...fromStore(store) };
  }

  const [[me, products, rules, orders], settings, suppliers, purchaseOrders, customers] = await Promise.all([
    common,
    api.get('/settings'),
    api.get('/suppliers'),
    api.get('/purchase-orders'),
    api.get('/customers'),
  ]);
  return {
    currentUser: me.user,
    products: products.products,
    pricingRules: rules.rules,
    orders: orders.orders,
    ...fromSettings(settings.settings),
    suppliers: suppliers.suppliers,
    purchaseOrders: purchaseOrders.purchaseOrders,
    users: customers.customers,
  };
}

export function AppProvider({ children }) {
  const [state, setState] = useState(INITIAL);
  const [toast, setToast] = useState(null);
  const [connection, setConnection] = useState('checking'); // 'checking' | 'online' | 'offline'
  const [refreshing, setRefreshing] = useState(false);
  // Push notifications on this phone: status 'checking' | 'on' | 'off' | 'unsupported';
  // while on, mode 'remote' (the backend pushes) or 'local' (the phone makes its own).
  const [push, setPush] = useState({ status: 'checking', mode: null, token: null, reason: null });
  const pushToken = useRef(null);
  // Goes up whenever data changes, so screens that load their own data (reports) reload too.
  const [dataVersion, setDataVersion] = useState(0);

  // The latest state, for async actions that read it after awaiting.
  const stateRef = useRef(INITIAL);
  const update = useCallback((changes) => {
    const next = typeof changes === 'function' ? changes(stateRef.current) : { ...stateRef.current, ...changes };
    stateRef.current = next;
    setState(next);
  }, []);

  const showToast = useCallback((message, tone = 'success') => {
    setToast({ message, tone, key: Date.now() });
  }, []);

  // Reloads everything from the server. `spinner` shows the pull-to-refresh spinner,
  // `quiet` hides the error toast (background refreshes).
  const refresh = useCallback(
    async ({ spinner = true, quiet = false } = {}) => {
      const user = stateRef.current.currentUser;
      if (!user) return;
      if (spinner) setRefreshing(true);
      try {
        const data = await fetchData(user);
        if (stateRef.current.currentUser?.id !== user.id) return; // logged out meanwhile
        checkForUpdates(user, updatesFrom(user, data)).catch(() => {});
        update((s) => ({ ...s, ...data, cart: cleanCart(s.cart, data.products) }));
        saveSession({ token: getAuthToken(), user: data.currentUser });
        setDataVersion((v) => v + 1);
      } catch (err) {
        if (!quiet && err.status !== 401) showToast(err.message, 'error');
      } finally {
        if (spinner) setRefreshing(false);
      }
    },
    [update, showToast]
  );

  // Gets this phone's Expo push token and hands it to the backend, so the store's
  // notifications reach whoever is logged in here. `ask` shows the permission prompt;
  // it is only passed when the user just logged in or tapped "Turn on notifications".
  //
  // When the phone allows notifications but this build cannot get push from the server
  // (no Firebase / EAS project id yet), the phone makes its own instead.
  const syncPush = useCallback(async ({ ask = false } = {}) => {
    const result = await getPushToken({ ask });
    if (result.ok) {
      try {
        await saveToken(result.token);
        pushToken.current = result.token;
        await applyPushMode('remote');
        setPush({ status: 'on', mode: 'remote', token: result.token, reason: null });
        return { ok: true, token: result.token };
      } catch (err) {
        // The token did not reach the server; it is sent again on the next app start.
        console.warn('[push] could not register this phone:', err.message);
      }
    } else if (result.status !== 'granted') {
      const status = result.status === 'unsupported' ? 'unsupported' : 'off';
      setPush({ status, mode: null, token: null, reason: result.reason });
      return { ok: false, error: result.reason };
    } else {
      console.log('[push] no push from the server in this build, the phone makes its own notifications:', result.reason);
    }
    await applyPushMode('local');
    setPush({ status: 'on', mode: 'local', token: null, reason: null });
    return { ok: true };
  }, []);

  // `unregister: false` when the session has already expired — the server would only answer 401.
  const logout = useCallback(
    ({ unregister = true } = {}) => {
      const token = pushToken.current;
      pushToken.current = null;
      setPush({ status: 'off', mode: null, token: null, reason: null });
      // Sent while the login token is still set; this phone must stop getting this
      // account's notifications before someone else logs in on it.
      if (unregister && token) forgetToken(token).catch(() => {});
      applyPushMode(null);

      setAuthToken(null);
      clearSession();
      // Keep the public store info for the login screen.
      update((s) => ({ ...INITIAL, ready: true, store: s.store, categories: s.categories, settings: s.settings }));
    },
    [update]
  );

  const recheckConnection = useCallback(() => {
    setConnection('checking');
    checkHealth();
  }, []);

  // Network status + expired logins, reported by the API client.
  useEffect(() => {
    onConnectionChange(setConnection);
    onUnauthorized(() => {
      if (!stateRef.current.currentUser) return;
      logout({ unregister: false });
      showToast('Your session has expired. Please log in again.', 'error');
    });
  }, [logout, showToast]);

  // App start: check the server, load the store info, and restore the saved login.
  useEffect(() => {
    checkHealth();
    api
      .get('/store')
      .then((s) => update((st) => ({ ...st, ...fromStore(s) })))
      .catch(() => {});
    loadSession().then(async (session) => {
      if (session?.token && session.user) {
        setAuthToken(session.token);
        update({ currentUser: session.user, ready: true });
        refresh({ quiet: true });
        // Expo can hand out a new token at any time, so it is sent again on every start.
        // Never asks here: the permission prompt belongs to the login screen. Stays off when
        // the user switched notifications off in the app.
        if ((await loadPushMode()) !== 'off' && (await permissionStatus()) === 'granted') syncPush();
        else setPush({ status: unsupportedReason() ? 'unsupported' : 'off', mode: null, token: null, reason: unsupportedReason() });
      } else {
        update({ ready: true });
        setPush({ status: unsupportedReason() ? 'unsupported' : 'off', mode: null, token: null, reason: unsupportedReason() });
      }
    });
  }, [update, refresh, syncPush]);

  // Keep checking while the app is open; catch up when it comes back to the foreground.
  useEffect(() => {
    let active = AppState.currentState !== 'background';
    const health = setInterval(() => active && checkHealth(), HEALTH_CHECK_MS);
    const data = setInterval(() => active && refresh({ spinner: false, quiet: true }), DATA_REFRESH_MS);
    const sub = AppState.addEventListener('change', (next) => {
      const wasActive = active;
      active = next === 'active';
      if (active && !wasActive) {
        checkHealth();
        refresh({ spinner: false, quiet: true });
      }
    });
    return () => {
      clearInterval(health);
      clearInterval(data);
      sub.remove();
    };
  }, [refresh]);

  // The phone makes its own notifications: look for updates every few seconds, and for a few
  // minutes after the app is put away. Only the newest orders are fetched, not everything.
  const watching = useRef(false);
  const watch = useCallback(async () => {
    const user = stateRef.current.currentUser;
    if (!user || watching.current) return;
    watching.current = true;
    try {
      const data = await fetchUpdates(user);
      if (stateRef.current.currentUser?.id !== user.id) return;
      // Something changed: bring the screens up to date too.
      if ((await checkForUpdates(user, data)).length) refresh({ spinner: false, quiet: true });
    } catch {
      // Offline: the status chip says so already; the next round tries again.
    } finally {
      watching.current = false;
    }
  }, [refresh]);

  const userId = state.currentUser?.id;
  const ownNotifications = push.status === 'on' && push.mode === 'local';
  useEffect(() => {
    if (!userId || !ownNotifications) return undefined;
    let timer = null;
    let hiddenSince = null;
    const loop = () => {
      clearTimeout(timer);
      const active = AppState.currentState === 'active';
      if (active) hiddenSince = null;
      else {
        hiddenSince ??= Date.now();
        if (Date.now() - hiddenSince > WATCH_HIDDEN_FOR_MS) return; // the background task carries on
      }
      watch();
      timer = setTimeout(loop, active ? WATCH_MS : WATCH_HIDDEN_MS);
    };
    timer = setTimeout(loop, WATCH_MS);
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      // Coming back runs a full refresh (above), which looks for updates too.
      hiddenSince = null;
      clearTimeout(timer);
      timer = setTimeout(loop, WATCH_MS);
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [userId, ownNotifications, watch]);

  // Back online after being offline: reload so nothing is stale.
  const lastConnection = useRef(connection);
  useEffect(() => {
    if (lastConnection.current === 'offline' && connection === 'online') refresh({ spinner: false, quiet: true });
    lastConnection.current = connection;
  }, [connection, refresh]);

  const actions = useMemo(() => {
    const get = () => stateRef.current;

    // Runs one change on the server. Errors become { ok: false, error } plus an error toast.
    const call = async (work, { quiet = false } = {}) => {
      try {
        const result = await work();
        setDataVersion((v) => v + 1);
        return { ok: true, ...result };
      } catch (err) {
        const error = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
        if (!quiet && err.status !== 401) showToast(error, 'error');
        // Someone else changed it first (another admin, rice sold out): show the latest data.
        if (err.status === 409) refresh({ spinner: false, quiet: true });
        return { ok: false, error, fields: err.fields };
      }
    };

    const setList = (key, fn) => update((s) => ({ ...s, [key]: fn(s[key]) }));
    const putItem = (key, item) => {
      setList(key, (list) => (list.some((x) => x.id === item.id) ? replaceById(list, item) : [item, ...list]));
      // Changed on this phone, so it is already on screen: no notification for it.
      if (key === 'orders' || key === 'users' || key === 'products') noteSeen(get().currentUser, { [key]: [item] });
    };

    // Stock changed on the server (sale, return, restock): get the new numbers.
    const reloadProducts = async () => {
      try {
        const { products } = await api.get('/products');
        update((s) => ({ ...s, products, cart: cleanCart(s.cart, products) }));
      } catch {
        // The next refresh catches up.
      }
    };

    const reloadSuppliers = async () => {
      try {
        update({ suppliers: (await api.get('/suppliers')).suppliers });
      } catch {
        // The next refresh catches up.
      }
    };

    const setMe = (user) => {
      update({ currentUser: user });
      saveSession({ token: getAuthToken(), user });
      noteSeen(user, { me: user });
      return { user };
    };

    // After login / register: load the user's data first, so the first screen is complete.
    const startSession = async ({ token, user }) => {
      setAuthToken(token);
      let data = null;
      try {
        data = await fetchData(user);
      } catch {
        // Still logged in; the screens fill in on the next refresh.
      }
      const me = data?.currentUser || user;
      update((s) => ({ ...s, ...data, currentUser: me, cart: [] }));
      saveSession({ token, user: me });
      // Whatever happened before this login is not news.
      if (data) checkForUpdates(me, updatesFrom(me, data), { quiet: true }).catch(() => {});
      // Logging in is the moment to ask about notifications. It runs on its own: the
      // permission prompt must not hold up the first screen, and saying no is fine.
      syncPush({ ask: true });
      return { user: me };
    };

    // Kilos of a variety already in the cart (optionally ignoring one cart line).
    const cartKgFor = (productId, excludeKey) =>
      get()
        .cart.filter((c) => c.productId === productId && c.key !== excludeKey)
        .reduce((sum, c) => sum + UNITS[c.unit].kg * c.qty, 0);

    return {
      refresh: (options) => refresh(options),

      // ---------- Auth ----------
      login: (email, password) =>
        call(async () => startSession(await api.post('/auth/login', { email: email.trim(), password })), { quiet: true }),

      register: (form) =>
        call(
          async () =>
            startSession(
              await api.post('/auth/register', {
                name: form.name.trim(),
                email: form.email.trim(),
                password: form.password,
                phone: form.phone.trim(),
                address: form.address.trim(),
                accountType: form.accountType,
                businessName: form.businessName.trim(),
              })
            ),
          { quiet: true }
        ),

      logout,

      // ---------- Push notifications ----------

      // "Turn on notifications" in the app: asks again and re-sends the token.
      enablePush: () => syncPush({ ask: true }),

      disablePush: () =>
        call(async () => {
          const token = pushToken.current;
          if (token) await forgetToken(token);
          pushToken.current = null;
          await applyPushMode('off'); // remembered, so they stay off after a restart
          setPush({ status: 'off', mode: null, token: null, reason: null });
          return {};
        }),

      // Asks the server to send one notification to this account's phones - or, when this
      // phone makes its own, shows one right here.
      sendTestPush: () =>
        call(async () => {
          if ((await loadPushMode()) === 'local') {
            await showLocalNotification({
              title: 'Bugasan ni Ali',
              body: 'Notifications are working on this phone. 🌾',
              data: { screen: 'home', test: true },
            });
            return { sent: 1 };
          }
          return { sent: (await sendTestNotification()).sent };
        }),

      // ---------- Profile ----------
      updateProfile: (changes) => call(async () => setMe((await api.patch('/me', changes)).user)),

      applyForWholesale: (businessName) =>
        call(async () => setMe((await api.post('/me/wholesale-application', { businessName })).user)),

      // ---------- Cart (kept on the device) ----------
      cartKgFor,

      addToCart(productId, unit, qty) {
        const product = get().products.find((p) => p.id === productId);
        if (!product) return { ok: false, error: 'This rice variety is no longer available.' };
        const key = `${productId}-${unit}`;
        const existing = get().cart.find((c) => c.key === key);
        const newQty = (existing ? existing.qty : 0) + qty;
        const kgNeeded = cartKgFor(productId, key) + UNITS[unit].kg * newQty;
        if (kgNeeded > product.stockKg) {
          return { ok: false, error: `Only ${product.stockKg} kg of ${product.name} is available.` };
        }
        const cart = existing
          ? get().cart.map((c) => (c.key === key ? { ...c, qty: newQty } : c))
          : [...get().cart, { key, productId, unit, qty }];
        update({ cart });
        return { ok: true };
      },

      setCartQty(key, qty) {
        const item = get().cart.find((c) => c.key === key);
        if (!item) return { ok: false };
        if (qty <= 0) {
          update({ cart: get().cart.filter((c) => c.key !== key) });
          return { ok: true };
        }
        const product = get().products.find((p) => p.id === item.productId);
        if (!product) return { ok: false, error: 'This rice variety is no longer available.' };
        if (cartKgFor(item.productId, key) + UNITS[item.unit].kg * qty > product.stockKg) {
          return { ok: false, error: `Only ${product.stockKg} kg available.` };
        }
        update({ cart: get().cart.map((c) => (c.key === key ? { ...c, qty } : c)) });
        return { ok: true };
      },

      removeFromCart(key) {
        update({ cart: get().cart.filter((c) => c.key !== key) });
      },

      // ---------- Orders (the server prices the order and deducts the stock) ----------
      placeOrder: ({ fulfillment, address, schedule, paymentMethod, paymentRef, notes }) =>
        call(
          async () => {
            const items = get().cart.map(({ productId, unit, qty }) => ({ productId, unit, qty }));
            const { order } = await api.post('/orders', { items, fulfillment, address, schedule, paymentMethod, paymentRef, notes });
            update((s) => ({ ...s, orders: [order, ...s.orders], cart: [] }));
            // Known from the start, so the store confirming it is noticed right away.
            noteSeen(get().currentUser, { orders: [order] });
            await reloadProducts();
            return { order };
          },
          { quiet: true }
        ),

      cancelOrder: (orderId, reason) =>
        call(async () => {
          const { order } = await api.post(`/orders/${orderId}/cancel`, reason ? { reason } : {});
          putItem('orders', order);
          await reloadProducts(); // the rice went back to inventory
          return { order };
        }),

      advanceOrder: (orderId) =>
        call(async () => {
          const { order } = await api.post(`/orders/${orderId}/advance`);
          putItem('orders', order);
          return { order };
        }),

      setRider: (orderId, rider) =>
        call(async () => {
          const { order } = await api.put(`/orders/${orderId}/rider`, { rider });
          putItem('orders', order);
          return { order };
        }),

      markPaid: (orderId) =>
        call(async () => {
          const { order } = await api.post(`/orders/${orderId}/mark-paid`);
          putItem('orders', order);
          return { order };
        }),

      // ---------- Inventory ----------
      addProduct: (data) =>
        call(async () => {
          const { product } = await api.post('/products', data);
          setList('products', (list) => [...list, product]);
          if (product.supplierId) await reloadSuppliers();
          return { product };
        }),

      updateProduct: (productId, changes) =>
        call(async () => {
          const { product } = await api.patch(`/products/${productId}`, changes);
          putItem('products', product);
          return { product };
        }),

      adjustStock: (productId, kgChange, note) =>
        call(async () => {
          const { product } = await api.post(`/products/${productId}/stock-adjustments`, { kgChange, note });
          putItem('products', product);
          return { product };
        }),

      // ---------- Suppliers ----------
      addSupplier: (data) =>
        call(async () => {
          const { supplier } = await api.post('/suppliers', data);
          setList('suppliers', (list) => [...list, supplier]);
          return { supplier };
        }),

      updateSupplier: (supplierId, changes) =>
        call(async () => {
          const { supplier } = await api.patch(`/suppliers/${supplierId}`, changes);
          putItem('suppliers', supplier);
          return { supplier };
        }),

      // ---------- Purchase orders / restocking ----------
      createPurchaseOrder: (data) =>
        call(async () => {
          const { purchaseOrder } = await api.post('/purchase-orders', data);
          setList('purchaseOrders', (list) => [purchaseOrder, ...list]);
          await reloadSuppliers(); // the supplier now lists these varieties
          return { po: purchaseOrder };
        }),

      receivePurchaseOrder: (poId) =>
        call(async () => {
          const { purchaseOrder } = await api.post(`/purchase-orders/${poId}/receive`);
          putItem('purchaseOrders', purchaseOrder);
          await reloadProducts(); // stock went up
          return { po: purchaseOrder };
        }),

      cancelPurchaseOrder: (poId) =>
        call(async () => {
          const { purchaseOrder } = await api.post(`/purchase-orders/${poId}/cancel`);
          putItem('purchaseOrders', purchaseOrder);
          return { po: purchaseOrder };
        }),

      // ---------- Wholesale customers ----------
      setWholesaleStatus: (userId, wholesaleStatus) =>
        call(async () => {
          const { customer } = await api.patch(`/customers/${userId}`, { wholesaleStatus });
          putItem('users', customer);
          return { customer };
        }),

      // ---------- Pricing rules & delivery settings ----------
      addRule: (data) =>
        call(async () => {
          const { rule } = await api.post('/pricing-rules', data);
          setList('pricingRules', (list) => [...list, rule]);
          return { rule };
        }),

      updateRule: (ruleId, changes) =>
        call(async () => {
          const { rule } = await api.patch(`/pricing-rules/${ruleId}`, changes);
          putItem('pricingRules', rule);
          return { rule };
        }),

      deleteRule: (ruleId) =>
        call(async () => {
          await api.delete(`/pricing-rules/${ruleId}`);
          setList('pricingRules', (list) => list.filter((r) => r.id !== ruleId));
          return {};
        }),

      updateSettings: (changes) =>
        call(async () => {
          const { settings } = await api.patch('/settings', changes);
          update(fromSettings(settings));
          return { settings };
        }),
    };
  }, [update, showToast, refresh, logout, syncPush]);

  const hideToast = useCallback(() => setToast(null), []);

  const value = {
    state,
    currentUser: state.currentUser,
    ready: state.ready,
    actions,
    toast,
    showToast,
    hideToast,
    connection,
    recheckConnection,
    refreshing,
    dataVersion,
    push,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
