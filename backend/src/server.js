// Starts the API:  npm start  (or  npm run dev  to restart on file changes)
import { app } from './app.js';
import { config } from './config.js';
import { db } from './db/index.js';

const server = app.listen(config.port, config.host, (err) => {
  if (err) throw err;
  console.log(`Bugasan ni Ali API listening on http://${config.host}:${config.port}`);
  const users = db.prepare('SELECT COUNT(*) FROM users').pluck().get();
  if (users === 0) console.log('The database is empty. Run `npm run seed` to load the demo data.');
});

// pm2 / systemd send SIGTERM on restart: finish open requests, then close the database cleanly.
function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
