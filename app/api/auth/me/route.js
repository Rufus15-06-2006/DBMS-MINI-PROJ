import { NextResponse } from 'next/server';
import { permissionsFor, readSession } from '../../../../lib/auth.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const user = readSession(request);
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  return NextResponse.json({ user, permissions: permissionsFor(user.role) });
}
