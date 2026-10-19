// npm run seed            loads the demo data into an empty database
// npm run seed -- --force wipes the database first (all real orders are lost!)
import { config } from '../config.js';
import { hasData, seedDemoData } from './demoData.js';

if (hasData() && !process.argv.includes('--force')) {
  console.error(`The database (${config.dbPath}) already has data.`);
  console.error('Run `npm run seed -- --force` to WIPE it and load the demo data instead.');
  process.exit(1);
}

const counts = seedDemoData();
console.log(`Demo data loaded into ${config.dbPath}:`, counts);
console.log('Logins: admin@bugasan.ph / admin123 · juan@email.com / 123456 · maria@email.com / 123456');
