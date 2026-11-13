import { NextResponse } from 'next/server';
import { PERMISSIONS, permissionsFor, readSession } from './security.js';

// Preserve the original import surface used by API routes.
export * from './security.js';

// Returns { user } when the caller is logged in and allowed to perform `action`, otherwise { response }.
export function authorize(request, action) {
  const user = readSession(request);
  if (!user) return { response: NextResponse.json({ error: 'Please sign in.' }, { status: 401 }) };
  if (!PERMISSIONS[action]?.includes(user.role)) {
    return { response: NextResponse.json({ error: `Your role (${user.role}) is not permitted to perform this action.` }, { status: 403 }) };
  }
  return { user };
}
