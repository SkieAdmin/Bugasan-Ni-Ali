// npm run set-password -- <email> <new password>
// Changes any account's password from the server (e.g. the admin's after seeding).
// Everyone logged in with that account is logged out.
import bcrypt from 'bcryptjs';
import { db } from './index.js';

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 6) {
  console.error('Usage: npm run set-password -- <email> <new password (6+ characters)>');
  process.exit(1);
}

const result = db
  .prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE email = ?')
  .run(bcrypt.hashSync(password, 10), email.trim().toLowerCase());

if (result.changes === 0) {
  console.error(`No account with the email ${email}.`);
  process.exit(1);
}
console.log(`Password changed for ${email}.`);
