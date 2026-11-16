import { NextResponse } from 'next/server';
import { sqlPool } from '../../../lib/mysql.js';
import { authorize } from '../../../lib/auth.js';
import { logEvent } from '../../../lib/audit.js';

export const dynamic = 'force-dynamic';

// Moves stock between warehouses, drawing the source's earliest-expiring non-expired batches first (FEFO).
// The destination receives a matching batch that keeps the original expiry date. All-or-nothing.
export async function POST(request) {
  const auth = authorize(request, 'transfer');
  if (auth.response) return auth.response;
  const { user } = auth;

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const productId = Number(body.productId), fromId = Number(body.fromWarehouseId), toId = Number(body.toWarehouseId), quantity = Number(body.quantity);
  if (![productId, fromId, toId, quantity].every((n) => Number.isInteger(n) && n > 0)) {
    return NextResponse.json({ error: 'Product, both warehouses and quantity must be positive integers.' }, { status: 400 });
  }
  if (fromId === toId) return NextResponse.json({ error: 'Source and destination warehouses must differ.' }, { status: 400 });

  const connection = await sqlPool.getConnection();
  const moved = [];
  try {
    await connection.beginTransaction();
    const [[product]] = await connection.query('SELECT product_id FROM products WHERE product_id = ? AND is_active = 1', [productId]);
    const [warehouses] = await connection.query('SELECT warehouse_id FROM warehouses WHERE warehouse_id IN (?, ?)', [fromId, toId]);
    if (!product || warehouses.length !== 2) {
      await connection.rollback();
      return NextResponse.json({ error: 'Product or warehouse does not exist.' }, { status: 404 });
    }

    const [batches] = await connection.query(`
      SELECT batch_id, batch_number, quantity, unit_cost,
             DATE_FORMAT(expiry_date, '%Y-%m-%d') AS expiry_str, DATE_FORMAT(received_at, '%Y-%m-%d') AS received_str
      FROM batches
      WHERE product_id = ? AND warehouse_id = ? AND quantity > 0 AND expiry_date >= CURDATE()
      ORDER BY expiry_date ASC, received_at ASC, batch_id ASC
      FOR UPDATE
    `, [productId, fromId]);
    const available = batches.reduce((sum, b) => sum + Number(b.quantity), 0);
    if (available < quantity) {
      await connection.rollback();
      return NextResponse.json({ error: `Only ${available} non-expired unit(s) are available at the source warehouse; nothing was transferred.` }, { status: 409 });
    }

    let remaining = quantity;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(Number(batch.quantity), remaining);
      await connection.query('UPDATE batches SET quantity = quantity - ? WHERE batch_id = ? AND quantity >= ?', [take, batch.batch_id, take]);
      const [src] = await connection.query('UPDATE inventory SET quantity = quantity - ? WHERE product_id = ? AND warehouse_id = ? AND quantity >= ?', [take, productId, fromId, take]);
      if (src.affectedRows !== 1) throw new Error('Source inventory summary is inconsistent with its batches.');

      const destBatchNumber = `${batch.batch_number}-W${toId}`.slice(0, 80);
      await connection.query(`
        INSERT INTO batches (product_id, warehouse_id, batch_number, quantity, expiry_date, received_at, unit_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + ?
      `, [productId, toId, destBatchNumber, take, batch.expiry_str, batch.received_str, batch.unit_cost, take]);
      await connection.query(`
        INSERT INTO inventory (product_id, warehouse_id, quantity, reorder_level) VALUES (?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE quantity = quantity + ?, last_updated_at = CURRENT_TIMESTAMP
      `, [productId, toId, take, take]);
      await connection.query(`
        INSERT INTO stock_movements (product_id, batch_id, source_warehouse_id, destination_warehouse_id, quantity, movement_type, performed_by, reason)
        VALUES (?, ?, ?, ?, ?, 'TRANSFER', ?, ?)
      `, [productId, batch.batch_id, fromId, toId, take, user.username, String(body.reason || 'Inter-warehouse transfer').slice(0, 250)]);
      moved.push({ batchNumber: batch.batch_number, quantity: take, expiryDate: batch.expiry_str });
      remaining -= take;
    }
    await connection.commit();
  } catch (error) {
    try { await connection.rollback(); } catch {}
    console.error('Transfer failed:', error);
    return NextResponse.json({ error: `Transfer failed and SQL changes were rolled back: ${error.message}` }, { status: 500 });
  } finally {
    connection.release();
  }

  const auditSaved = await logEvent('STOCK_TRANSFERRED', {
    product_id: productId, source_warehouse_id: fromId, destination_warehouse_id: toId, quantity, allocations: moved,
    actor: user.username, role: user.role, metadata: { policy: 'FEFO' }
  });
  return NextResponse.json({ message: 'Transfer completed.', productId, quantity, moved, auditSaved });
}
