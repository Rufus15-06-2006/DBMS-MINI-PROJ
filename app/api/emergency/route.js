import { NextResponse } from 'next/server';
import { sqlPool } from '../../../lib/mysql.js';
import { authorize } from '../../../lib/auth.js';
import { logEvent } from '../../../lib/audit.js';

export const dynamic = 'force-dynamic';

// POST { action: 'create', productId, departmentId, quantity, reason }   -> record an urgent requirement
// POST { action: 'order', requestId, supplierId, expectedDays }          -> turn an OPEN requirement into a purchase order
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  return body.action === 'order' ? orderRequest(request, body) : createRequest(request, body);
}

async function createRequest(request, body) {
  const auth = authorize(request, 'requestEmergency');
  if (auth.response) return auth.response;
  const { user } = auth;
  const productId = Number(body.productId);
  const quantity = Number(body.quantity);
  const departmentId = user.role === 'DEPARTMENT_STAFF' ? Number(user.departmentId) : Number(body.departmentId);
  const reason = String(body.reason || '').trim().slice(0, 250);
  if (![productId, quantity, departmentId].every((n) => Number.isInteger(n) && n > 0) || !reason) {
    return NextResponse.json({ error: 'Product, department, positive quantity and a reason are required.' }, { status: 400 });
  }
  try {
    const [result] = await sqlPool.query(
      "INSERT INTO emergency_requests (product_id, department_id, quantity_needed, reason, status, requested_by) VALUES (?, ?, ?, ?, 'OPEN', ?)",
      [productId, departmentId, quantity, reason, user.username]);
    const auditSaved = await logEvent('EMERGENCY_REQUEST_CREATED', { request_id: result.insertId, product_id: productId, department_id: departmentId, quantity, reason, actor: user.username, role: user.role });
    return NextResponse.json({ message: `Emergency request #${result.insertId} recorded.`, requestId: result.insertId, auditSaved });
  } catch (error) {
    return NextResponse.json({ error: `Request not saved: ${error.message}` }, { status: error.code === 'ER_NO_REFERENCED_ROW_2' ? 404 : 500 });
  }
}

async function orderRequest(request, body) {
  const auth = authorize(request, 'fulfillEmergency');
  if (auth.response) return auth.response;
  const { user } = auth;
  const requestId = Number(body.requestId), supplierId = Number(body.supplierId), expectedDays = Number(body.expectedDays ?? 2);
  if (![requestId, supplierId].every((n) => Number.isInteger(n) && n > 0) || !Number.isInteger(expectedDays) || expectedDays < 1 || expectedDays > 60) {
    return NextResponse.json({ error: 'Choose a request, a supplier and an expected delivery between 1 and 60 days.' }, { status: 400 });
  }
  const connection = await sqlPool.getConnection();
  let orderId, req;
  try {
    await connection.beginTransaction();
    [[req]] = await connection.query("SELECT er.request_id, er.product_id, er.quantity_needed, p.unit_cost FROM emergency_requests er JOIN products p ON p.product_id = er.product_id WHERE er.request_id = ? AND er.status = 'OPEN' FOR UPDATE", [requestId]);
    const [[supplier]] = await connection.query('SELECT supplier_id FROM suppliers WHERE supplier_id = ? AND active = 1', [supplierId]);
    if (!req || !supplier) { await connection.rollback(); return NextResponse.json({ error: 'Request is not open, or the supplier is unavailable.' }, { status: 409 }); }
    await connection.query('CALL sp_create_purchase_order(?, DATE_ADD(CURDATE(), INTERVAL ? DAY), @new_order_id)', [supplierId, expectedDays]);
    [[{ id: orderId }]] = await connection.query('SELECT @new_order_id AS id');
    await connection.query('INSERT INTO order_items (order_id, product_id, quantity_ordered, unit_price) VALUES (?, ?, ?, ?)', [orderId, req.product_id, req.quantity_needed, req.unit_cost]);
    await connection.query('UPDATE purchase_orders SET notes = ? WHERE order_id = ?', [`Emergency procurement for request #${requestId}`, orderId]);
    await connection.query("UPDATE emergency_requests SET status = 'ORDERED', order_id = ? WHERE request_id = ?", [orderId, requestId]);
    await connection.commit();
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return NextResponse.json({ error: `Order was not created: ${error.message}` }, { status: 500 });
  } finally { connection.release(); }
  const auditSaved = await logEvent('EMERGENCY_ORDER_PLACED', { request_id: requestId, order_id: orderId, supplier_id: supplierId, product_id: req.product_id, quantity: req.quantity_needed, actor: user.username, role: user.role });
  return NextResponse.json({ message: `Request #${requestId} converted to purchase order #${orderId}.`, orderId, auditSaved });
}
