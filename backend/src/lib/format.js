// Formatting helpers (currency, weight, dates).
// Copied from frontend/src/utils/format.js so report text matches the app. Keep the two in sync.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function withCommas(numberString) {
  return numberString.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function peso(amount, decimals = 2) {
  const value = Number(amount) || 0;
  const sign = value < 0 ? '-' : '';
  const [whole, cents] = Math.abs(value).toFixed(decimals).split('.');
  return `${sign}₱${withCommas(whole)}${cents ? `.${cents}` : ''}`;
}

export function number(value, decimals = 0) {
  const [whole, frac] = (Number(value) || 0).toFixed(decimals).split('.');
  return `${withCommas(whole)}${frac ? `.${frac}` : ''}`;
}

export function kg(value) {
  const n = Number(value) || 0;
  return `${number(n, Number.isInteger(n) ? 0 : 1)} kg`;
}

// 1,250 kg -> "25 sacks"
export function sacks(kgValue) {
  const s = (Number(kgValue) || 0) / 50;
  const text = Number.isInteger(s) ? number(s) : number(s, 1);
  return `${text} ${s === 1 ? 'sack' : 'sacks'}`;
}

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(value) {
  const d = toDate(value);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function formatShortDate(value) {
  const d = toDate(value);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function formatDayLabel(value) {
  const d = toDate(value);
  return { day: DAYS[d.getDay()], date: d.getDate(), month: MONTHS[d.getMonth()] };
}

export function formatTime(value) {
  const d = toDate(value);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function formatDateTime(value) {
  return `${formatDate(value)} · ${formatTime(value)}`;
}

export function isSameDay(a, b) {
  const x = toDate(a);
  const y = toDate(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export function startOfDay(value) {
  const d = new Date(toDate(value));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(value, days) {
  const d = new Date(toDate(value));
  d.setDate(d.getDate() + days);
  return d;
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}
