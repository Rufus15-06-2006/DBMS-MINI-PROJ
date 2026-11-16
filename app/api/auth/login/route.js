import { NextResponse } from 'next/server';
import { sqlPool } from '../../../../lib/mysql.js';
import { COOKIE_NAME, SESSION_SECONDS, createSessionToken, permissionsFor, verifyPassword } from '../../../../lib/auth.js';
import { logEvent } from '../../../../lib/audit.js';

export const dynamic = 'force-dynamic';

// Very small in-memory throttle: 5 failed attempts per username per minute.
const failures = globalThis.__loginFailures ?? (globalThis.__loginFailures = new Map());

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!username || !password) return NextResponse.json({ error: 'Enter a username and password.' }, { status: 400 });

  const recent = (failures.get(username) || []).filter((t) => Date.now() - t < 60000);
  if (recent.length >= 5) return NextResponse.json({ error: 'Too many failed attempts. Wait a minute and try again.' }, { status: 429 });

  const [rows] = await sqlPool.query(
    'SELECT user_id, full_name, username, password_hash, role, department_id FROM users WHERE username = ? AND is_active = 1', [username]);
  const user = rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    failures.set(username, [...recent, Date.now()]);
    return NextResponse.json({ error: 'Incorrect username or password.' }, { status: 401 });
  }
  failures.delete(username);
  await logEvent('USER_LOGIN', { actor: user.username, role: user.role });

  const response = NextResponse.json({ user: { username: user.username, fullName: user.full_name, role: user.role, departmentId: user.department_id }, permissions: permissionsFor(user.role) });
  response.cookies.set(COOKIE_NAME, createSessionToken(user), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: SESSION_SECONDS, secure: process.env.NODE_ENV === 'production'
  });
  return response;
}
