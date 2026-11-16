import crypto from 'node:crypto';

// Session = signed cookie (HMAC-SHA256). Passwords are stored as scrypt hashes.
// The fallback is for local development only. Production must supply a unique 32+ character secret.
const DEVELOPMENT_SECRET = 'dev-only-secret-change-me';

function getSigningSecret() {
  const configured = process.env.AUTH_SECRET?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET must be configured in production.');
    }
    return DEVELOPMENT_SECRET;
  }
  if (process.env.NODE_ENV === 'production' && Buffer.byteLength(configured, 'utf8') < 32) {
    throw new Error('AUTH_SECRET must contain at least 32 characters in production.');
  }
  return configured;
}
export const COOKIE_NAME = 'hsc_session';
export const SESSION_SECONDS = 8 * 60 * 60;

export const ROLES = ['ADMIN', 'PROCUREMENT_OFFICER', 'WAREHOUSE_MANAGER', 'DEPARTMENT_STAFF'];

// Role-based access control matrix: action -> roles allowed to perform it.
export const PERMISSIONS = {
  view: ROLES,
  allocate: ['ADMIN', 'WAREHOUSE_MANAGER', 'DEPARTMENT_STAFF'],
  transfer: ['ADMIN', 'WAREHOUSE_MANAGER'],
  createOrder: ['ADMIN', 'PROCUREMENT_OFFICER'],
  receiveOrder: ['ADMIN', 'PROCUREMENT_OFFICER', 'WAREHOUSE_MANAGER'],
  requestEmergency: ['ADMIN', 'WAREHOUSE_MANAGER', 'DEPARTMENT_STAFF'],
  fulfillEmergency: ['ADMIN', 'PROCUREMENT_OFFICER'],
  maintenance: ['ADMIN', 'WAREHOUSE_MANAGER']
};

export const permissionsFor = (role) => Object.keys(PERMISSIONS).filter((action) => PERMISSIONS[action].includes(role));

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [algorithm, salt, hash] = String(stored || '').split(':');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  if (expected.length === 0) return false;
  const actual = crypto.scryptSync(String(password), salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const sign = (payload) => crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('base64url');

export function createSessionToken(user) {
  const payload = Buffer.from(JSON.stringify({
    uid: user.user_id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    departmentId: user.department_id ?? null,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readSession(request) {
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.exp > Date.now() / 1000 ? session : null;
  } catch {
    return null;
  }
}
