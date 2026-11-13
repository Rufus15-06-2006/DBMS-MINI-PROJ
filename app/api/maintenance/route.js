import { NextResponse } from 'next/server';
import { sqlPool } from '../../../lib/mysql.js';
import { authorize } from '../../../lib/auth.js';
import { logEvent } from '../../../lib/audit.js';

export const dynamic = 'force-dynamic';

// POST { action: 'expiry-scan' }  -> CALL sp_refresh_expiry_alerts   (raise NEAR_EXPIRY alerts)
// POST { action: 'write-off' }    -> CALL sp_write_off_expired       (remove expired stock from inventory)
export async function POST(request) {
  const auth = authorize(request, 'maintenance');
  if (auth.response) return auth.response;
  const { user } = auth;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  const connection = await sqlPool.getConnection();
  try {
    if (body.action === 'expiry-scan') {
      await connection.query('CALL sp_refresh_expiry_alerts(@created)');
      const [[{ n }]] = await connection.query('SELECT @created AS n');
      const auditSaved = await logEvent('EXPIRY_SCAN', { alerts_created: Number(n), actor: user.username, role: user.role });
      return NextResponse.json({ message: `Expiry scan complete: ${n} new alert(s) raised.`, created: Number(n), auditSaved });
    }
    if (body.action === 'write-off') {
      await connection.query('CALL sp_write_off_expired(?, @batches)', [user.username]);
      const [[{ n }]] = await connection.query('SELECT @batches AS n');
      const auditSaved = await logEvent('EXPIRED_WRITE_OFF', { batches_written_off: Number(n), actor: user.username, role: user.role });
      return NextResponse.json({ message: `${n} expired batch(es) written off.`, batches: Number(n), auditSaved });
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: `Maintenance task failed: ${error.message}` }, { status: 500 });
  } finally { connection.release(); }
}
