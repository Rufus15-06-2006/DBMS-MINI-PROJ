// Usage: node scripts/hash-password.mjs "NewPassword"   -> paste the output into users.password_hash
import crypto from 'node:crypto';
const password = process.argv[2];
if (!password) { console.error('Usage: node scripts/hash-password.mjs "<password>"'); process.exit(1); }
const salt = crypto.randomBytes(16).toString('hex');
console.log(`scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`);
