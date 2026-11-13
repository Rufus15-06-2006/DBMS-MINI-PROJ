import { NextResponse } from 'next/server';
import { sqlPool } from '../../../lib/mysql.js';
import { authorize } from '../../../lib/auth.js';
import { logEvent } from '../../../lib/audit.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = authorize(request, 'allocate');
  if (auth.response) return auth.response;
  const { user } = auth;

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  const productId = Number(body.productId);
  // Department staff may only request stock for their own department.
  const departmentId = user.role === 'DEPARTMENT_STAFF' ? Number(user.departmentId) : Number(body.departmentId);
  const requestedQuantity = Number(body.quantity);
  const reason = String(body.reason || 'Department stock request').trim().slice(0, 250);

  if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(departmentId) || departmentId <= 0 || !Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
    return NextResponse.json({ error: 'productId, departmentId and quantity must be positive integers.' }, { status: 400 });
  }
  if (!reason) return NextResponse.json({ error: 'Please provide a reason for the request.' }, { status: 400 });

  if (user.role === 'DEPARTMENT_STAFF' && Number(body.departmentId) !== departmentId) {
    return NextResponse.json({ error: 'Department staff can only request stock for their own department.' }, { status: 403 });
  }

  const connection = await sqlPool.getConnection();
  let emergencyRequestId = null;
  let allocatedQuantity = 0;
  let remaining = requestedQuantity;
  const allocations = [];

  try {
    await connection.beginTransaction();
    const [productRows] = await connection.query('SELECT product_id, name FROM products WHERE product_id = ? AND is_active = 1', [productId]);
    const [departmentRows] = await connection.query('SELECT department_id, name FROM departments WHERE department_id = ?', [departmentId]);
    if (!productRows.length || !departmentRows.length) {
      await connection.rollback();
      return NextResponse.json({ error: 'Selected product or department does not exist.' }, { status: 404 });
    }

    // FEFO: choose the earliest-expiring eligible batch first. Expired batches are excluded.
    const [batches] = await connection.query(`
      SELECT b.batch_id, b.batch_number, b.product_id, b.warehouse_id, b.quantity, b.expiry_date,
             w.name AS warehouse_name
      FROM batches b JOIN warehouses w ON w.warehouse_id = b.warehouse_id
      WHERE b.product_id = ? AND b.quantity > 0 AND b.expiry_date >= CURDATE()
      ORDER BY b.expiry_date ASC, b.received_at ASC, b.batch_id ASC
      FOR UPDATE
    `, [productId]);

    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(Number(batch.quantity), remaining);
      if (take <= 0) continue;

      await connection.query('UPDATE batches SET quantity = quantity - ? WHERE batch_id = ? AND quantity >= ?', [take, batch.batch_id, take]);
      const [inventoryResult] = await connection.query(
        'UPDATE inventory SET quantity = quantity - ?, last_updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND warehouse_id = ? AND quantity >= ?',
        [take, productId, batch.warehouse_id, take]
      );
      if (inventoryResult.affectedRows !== 1) throw new Error(`Inventory summary is inconsistent for product ${productId} in warehouse ${batch.warehouse_id}.`);

      await connection.query(`
        INSERT INTO stock_movements (product_id, batch_id, source_warehouse_id, destination_department_id,
          quantity, movement_type, performed_by, reason, created_at)
        VALUES (?, ?, ?, ?, ?, 'ISSUE', ?, ?, CURRENT_TIMESTAMP)
      `, [productId, batch.batch_id, batch.warehouse_id, departmentId, take, user.username, reason]);

      allocations.push({ batchId: batch.batch_id, batchNumber: batch.batch_number, warehouse: batch.warehouse_name, quantity: take, expiryDate: batch.expiry_date });
      allocatedQuantity += take;
      remaining -= take;
    }

    if (remaining > 0) {
      await connection.query(`
        INSERT INTO stock_alerts (product_id, warehouse_id, alert_type, message, created_at)
        VALUES (?, NULL, 'EMERGENCY_SHORTAGE', ?, CURRENT_TIMESTAMP)
      `, [productId, `${remaining} unit(s) of ${productRows[0].name} remain unfulfilled for ${departmentRows[0].name}. Reason: ${reason}`]);
      // The unmet quantity automatically becomes an open emergency procurement request.
      const [requestResult] = await connection.query(`
        INSERT INTO emergency_requests (product_id, department_id, quantity_needed, reason, status, requested_by)
        VALUES (?, ?, ?, ?, 'OPEN', ?)
      `, [productId, departmentId, remaining, `Shortfall after FEFO allocation: ${reason}`.slice(0, 255), user.username]);
      emergencyRequestId = requestResult.insertId;
    }

    await connection.commit();
  } catch (error) {
    try { await connection.rollback(); } catch {}
    console.error('Allocation transaction failed:', error);
    return NextResponse.json({ error: `Allocation failed and SQL changes were rolled back: ${error.message}` }, { status: 500 });
  } finally {
    connection.release();
  }

  // SQL has committed; the audit write is separate (no distributed transaction) and reported separately.
  const auditSaved = await logEvent(remaining > 0 ? 'EMERGENCY_SHORTAGE_ALLOCATION' : 'STOCK_ISSUED', {
    product_id: productId, department_id: departmentId, requested_quantity: requestedQuantity,
    quantity: allocatedQuantity, shortfall: remaining, allocations, reason, actor: user.username, role: user.role,
    emergency_request_id: emergencyRequestId,
    metadata: { allocation_policy: 'FEFO', excludes_expired_batches: true }
  });

  return NextResponse.json({
    message: remaining > 0 ? 'Partial allocation completed; emergency procurement is required.' : 'Allocation completed.',
    productId, departmentId, requestedQuantity, allocatedQuantity, shortfall: remaining,
    allocations, auditSaved, emergencyRequestId
  });
}
