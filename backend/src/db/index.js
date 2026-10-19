// Opens the SQLite database, creates the tables and fills in default settings.
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { DEFAULT_SETTINGS } from './defaults.js';

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const database = new Database(file);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');
  database.exec(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));

  const insert = database.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) insert.run(key, JSON.stringify(value));
  return database;
}

export const db = open(config.dbPath);

// Runs fn inside a transaction: if it throws, every change it made is undone.
// Stock changes always go through here so an order never deducts half its rice.
export function transaction(fn) {
  return db.transaction(fn)();
}

// SQLite has no booleans; store them as 1 / 0.
export const toDb = (value) => (typeof value === 'boolean' ? Number(value) : value);

// Updates the given fields of one row. `columns` maps API field names to column names;
// fields that are missing from `columns` or undefined in `changes` are ignored.
export function updateRow(table, columns, id, changes) {
  const keys = Object.keys(changes).filter((k) => columns[k] && changes[k] !== undefined);
  if (!keys.length) return;
  const params = { id };
  keys.forEach((k) => {
    params[k] = toDb(changes[k]);
  });
  const assignments = keys.map((k) => `${columns[k]} = @${k}`).join(', ');
  db.prepare(`UPDATE ${table} SET ${assignments} WHERE id = @id`).run(params);
}

export const groupBy = (rows, key) => {
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row[key])) map.set(row[key], []);
    map.get(row[key]).push(row);
  });
  return map;
};
