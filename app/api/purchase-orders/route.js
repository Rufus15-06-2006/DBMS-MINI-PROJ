import { NextResponse } from 'next/server';
import { sqlPool } from '../../../lib/mysql.js';
import { authorize } from '../../../lib/auth.js';
import { logEvent } from '../../../lib/audit.js';

export const dynamic = 'force-dynamic';
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !Number.isNaN(Date.parse(v));

// POST { action: 'create', supplierId, expectedDays, notes, items: [{ productId, quantity, unitPrice }] }
// POST { action: 'receive', orderId, warehouseId, lines: [{ orderItemId, quantity, expiryDate }] }
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  if (body.action === 'create') return createOrder(request, body);
  if (body.action === 'receive') return receiveOrder(request, body);
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}

async function createOrder(request, body) {
  const auth = authorize(request, 'createOrder');
  if (auth.response) return auth.response;
  const { user } = auth;

  const supplierId = Number(body.supplierId);
  const expectedDays = Number(body.expectedDays ?? 7);
  const items = Array.isArray(body.items) ? body.items : [];
  const clean = items.map((i) => ({ productId: Number(i.productId), quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) }));
  if (!Number.isInteger(supplierId) || supplierId <= 0 || !Number.isInteger(expectedDays) || expectedDays < 1 || expectedDays > 180) {
    return NextResponse.json({ error: 'Choose a supplier and an expected delivery between 1 and 180 days.' }, { status: 400 });
  }
  if (!clean.length || clean.some((i) => !Number.isInteger(i.productId) || !Number.isInteger(i.quantity) || i.quantity <= 0 || !(i.unitPrice >= 0))) {
    return NextResponse.json({ error: 'Add at least one valid line (product, positive quantity, non-negative price).' }, { status: 400 });
  }
  if (new Set(clean.map((i) => i.productId)).size !== clean.length) {
    return NextResponse.json({ error: 'Each product may appear only once per order.' }, { status: 400 });
  }

  const connection = await sqlPool.getConnection();
  let orderId, total;
  try {
    await connection.beginTransaction();
    const [[supplier]] = await connection.query('SELECT supplier_id FROM suppliers WHERE supplier_id = ? AND active = 1', [supplierId]);
    if (!supplier) { await connection.rollback(); return NextResponse.json({ error: 'Supplier not found or inactive.' }, { status: 404 }); }
    await connection.query('CALL sp_create_purchase_order(?, DATE_ADD(CURDATE(), INTERVAL ? DAY), @new_order_id)', [supplierId, expectedDays]);
    [[{ id: orderId }]] = await connection.query('SELECT @new_order_id AS id');
    for (const item of clean) {
      await connection.query('INSERT INTO order_items (order_id, product_id, quantity_ordered, unit_price) VALUES (?, ?, ?, ?)', [orderId, item.productId, item.quantity, item.unitPrice]);
    }
    if (body.notes) await connection.query('UPDATE purchase_orders SET notes = ? WHERE order_id = ?', [String(body.notes).slice(0, 250), orderId]);
    [[{ total }]] = await connection.query('SELECT total_amount AS total FROM purchase_orders WHERE order_id = ?', [orderId]); // maintained by trigger
    await connection.commit();
  } catch (error) {
    try { await connection.rollback(); } catch {}
    console.error('Create order failed:', error);
    return NextResponse.json({ error: `Order was not created: ${error.message}` }, { status: 500 });
  } finally { connection.release(); }

  const auditSaved = await logEvent('PURCHASE_ORDER_CREATED', { order_id: orderId, supplier_id: supplierId, items: clean, total_amount: total, actor: user.username, role: user.role });
  return NextResponse.json({ message: `Purchase order #${orderId} created.`, orderId, totalAmount: total, auditSaved });
}

async function receiveOrder(request, body) {
  const auth = authorize(request, 'receiveOrder');
  if (auth.response) return auth.response;
  const { user } = auth;

  const orderId = Number(body.orderId), warehouseId = Number(body.warehouseId);
  const lines = (Array.isArray(body.lines) ? body.lines : []).map((l) => ({ orderItemId: Number(l.orderItemId), quantity: Number(l.quantity), expiryDate: String(l.expiryDate || '') }));
  if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(warehouseId) || warehouseId <= 0) {
    return NextResponse.json({ error: 'Choose a purchase order and a receiving warehouse.' }, { status: 400 });
  }
  const active = lines.filter((l) => l.quantity > 0);
  if (!active.length) return NextResponse.json({ error: 'Enter a received quantity for at least one line.' }, { status: 400 });
  const today = new Date().toISOString().slice(0, 10);
  if (active.some((l) => !Number.isInteger(l.orderItemId) || !Number.isInteger(l.quantity) || !isDate(l.expiryDate) || l.expiryDate <= today)) {
    return NextResponse.json({ error: 'Each received line needs a whole quantity and a future expiry date.' }, { status: 400 });
  }

  const connection = await sqlPool.getConnection();
  let status, received = [];
  try {
    await connection.beginTransaction();
    const [[order]] = await connection.query('SELECT order_id, status FROM purchase_orders WHERE order_id = ? FOR UPDATE', [orderId]);
    const [[warehouse]] = await connection.query('SELECT warehouse_id FROM warehouses WHERE warehouse_id = ?', [warehouseId]);
    if (!order || !warehouse) { await connection.rollback(); return NextResponse.json({ error: 'Order or warehouse not found.' }, { status: 404 }); }
    if (!['PENDING', 'PARTIAL'].includes(order.status)) { await connection.rollback(); return NextResponse.json({ error: `Order #${orderId} is ${order.status} and cannot receive stock.` }, { status: 409 }); }

    for (const line of active) {
      const [[item]] = await connection.query('SELECT order_item_id, product_id, quantity_ordered, quantity_received, unit_price FROM order_items WHERE order_item_id = ? AND order_id = ? FOR UPDATE', [line.orderItemId, orderId]);
      if (!item) throw new Error(`Line ${line.orderItemId} does not belong to order #${orderId}.`);
      const outstanding = item.quantity_ordered - item.quantity_received;
      if (line.quantity > outstanding) throw new Error(`Line ${line.orderItemId}: only ${outstanding} unit(s) are still outstanding.`);

      const batchNumber = `PO${orderId}-I${item.order_item_id}-${Date.now().toString(36).toUpperCase()}`.slice(0, 80);
      const [batchResult] = await connection.query(`
        INSERT INTO batches (product_id, warehouse_id, batch_number, quantity, expiry_date, received_at, unit_cost)
        VALUES (?, ?, ?, ?, ?, CURDATE(), ?)`, [item.product_id, warehouseId, batchNumber, line.quantity, line.expiryDate, item.unit_price]);
      await connection.query(`
        INSERT INTO inventory (product_id, warehouse_id, quantity, reorder_level) VALUES (?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE quantity = quantity + ?, last_updated_at = CURRENT_TIMESTAMP`, [item.product_id, warehouseId, line.quantity, line.quantity]);
      await connection.query('UPDATE order_items SET quantity_received = quantity_received + ? WHERE order_item_id = ?', [line.quantity, item.order_item_id]);
      await connection.query(`
        INSERT INTO stock_movements (product_id, batch_id, destination_warehouse_id, quantity, movement_type, performed_by, reason)
        VALUES (?, ?, ?, ?, 'RECEIPT', ?, ?)`, [item.product_id, batchResult.insertId, warehouseId, line.quantity, user.username, `Received against PO #${orderId}`]);
      // Stock has recovered above the reorder level, so close the matching LOW_STOCK alert.
      await connection.query(`
        UPDATE stock_alerts a JOIN inventory i ON i.product_id = a.product_id AND i.warehouse_id = a.warehouse_id
        SET a.resolved_at = CURRENT_TIMESTAMP
        WHERE a.alert_type = 'LOW_STOCK' AND a.resolved_at IS NULL AND i.quantity > i.reorder_level
          AND a.product_id = ? AND a.warehouse_id = ?`, [item.product_id, warehouseId]);
      received.push({ productId: item.product_id, batchNumber, quantity: line.quantity, expiryDate: line.expiryDate });
    }

    const [[{ pending }]] = await connection.query('SELECT COUNT(*) AS pending FROM order_items WHERE order_id = ? AND quantity_received < quantity_ordered', [orderId]);
    status = pending > 0 ? 'PARTIAL' : 'RECEIVED';
    await connection.query('UPDATE purchase_orders SET status = ?, received_date = CASE WHEN ? = \'RECEIVED\' THEN CURDATE() ELSE received_date END WHERE order_id = ?', [status, status, orderId]);
    if (status === 'RECEIVED') await connection.query("UPDATE emergency_requests SET status = 'CLOSED' WHERE order_id = ? AND status = 'ORDERED'", [orderId]);
    await connection.commit();
  } catch (error) {
    try { await connection.rollback(); } catch {}
    console.error('Receive order failed:', error);
    return NextResponse.json({ error: `Receipt failed and SQL changes were rolled back: ${error.message}` }, { status: 500 });
  } finally { connection.release(); }

  const auditSaved = await logEvent('PURCHASE_ORDER_RECEIVED', { order_id: orderId, warehouse_id: warehouseId, status, allocations: received, actor: user.username, role: user.role });
  return NextResponse.json({ message: `Order #${orderId} is now ${status}.`, orderId, status, received, auditSaved });
}
