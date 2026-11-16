import { NextResponse } from 'next/server';
import { sqlPool } from '../../../lib/mysql.js';
import { getMongoDatabase } from '../../../lib/mongo.js';
import { authorize, permissionsFor } from '../../../lib/auth.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = authorize(request, 'view');
  if (auth.response) return auth.response;
  try {
    const [summaryRows] = await sqlPool.query(`
      SELECT
        (SELECT COUNT(*) FROM products WHERE is_active = 1) AS activeProducts,
        (SELECT COUNT(*) FROM v_low_stock_inventory) AS lowStockRecords,
        (SELECT COUNT(*) FROM v_near_expiry_batches) AS nearExpiryBatches,
        (SELECT COUNT(*) FROM purchase_orders WHERE status IN ('PENDING','PARTIAL')) AS openOrders,
        (SELECT COUNT(*) FROM emergency_requests WHERE status = 'OPEN') AS openEmergency,
        (SELECT COUNT(*) FROM stock_alerts WHERE resolved_at IS NULL) AS openAlerts
    `);
    const [lowStock] = await sqlPool.query(`
      SELECT product_id, product_name, warehouse_name, quantity, reorder_level
      FROM v_low_stock_inventory ORDER BY quantity ASC, product_name ASC LIMIT 100
    `);
    const [nearExpiry] = await sqlPool.query(`
      SELECT batch_id, product_id, product_name, batch_number, warehouse_name, quantity, expiry_date,
             DATEDIFF(expiry_date, CURDATE()) AS days_to_expiry
      FROM v_near_expiry_batches ORDER BY expiry_date ASC LIMIT 100
    `);
    const [supplierPerformance] = await sqlPool.query(`
      SELECT supplier_id, supplier_name, total_orders, received_orders, on_time_orders,
             on_time_pct, avg_days_to_receive
      FROM v_supplier_performance ORDER BY on_time_pct DESC, total_orders DESC
    `);
    const [departmentIssues] = await sqlPool.query(`
      SELECT department_id, department_name, issue_count, total_units_issued
      FROM v_department_issue_summary ORDER BY total_units_issued DESC
    `);
    const [products] = await sqlPool.query(`
      SELECT p.product_id, p.name, p.category, p.unit, p.unit_cost,
             COALESCE(SUM(i.quantity), 0) AS total_stock
      FROM products p LEFT JOIN inventory i ON i.product_id = p.product_id
      WHERE p.is_active = 1 GROUP BY p.product_id, p.name, p.category, p.unit, p.unit_cost
      ORDER BY p.name
    `);
    const [departments] = await sqlPool.query('SELECT department_id, name FROM departments ORDER BY name');
    const [warehouses] = await sqlPool.query('SELECT warehouse_id, name FROM warehouses ORDER BY name');
    const [suppliers] = await sqlPool.query('SELECT supplier_id, name FROM suppliers WHERE active = 1 ORDER BY name');
    const [purchaseOrders] = await sqlPool.query(`
      SELECT po.order_id, s.name AS supplier_name, po.order_date, po.expected_date, po.received_date, po.status, po.total_amount, po.notes
      FROM purchase_orders po JOIN suppliers s ON s.supplier_id = po.supplier_id ORDER BY po.order_id DESC LIMIT 15
    `);
    const [openOrderItems] = await sqlPool.query(`
      SELECT oi.order_item_id, oi.order_id, oi.product_id, p.name AS product_name, oi.quantity_ordered, oi.quantity_received, oi.unit_price
      FROM order_items oi JOIN purchase_orders po ON po.order_id = oi.order_id JOIN products p ON p.product_id = oi.product_id
      WHERE po.status IN ('PENDING','PARTIAL') AND oi.quantity_received < oi.quantity_ordered ORDER BY oi.order_id, oi.order_item_id
    `);
    const [emergencyRequests] = await sqlPool.query(`
      SELECT er.request_id, p.name AS product_name, d.name AS department_name, er.quantity_needed, er.reason, er.status, er.requested_by, er.order_id, er.created_at
      FROM emergency_requests er JOIN products p ON p.product_id = er.product_id LEFT JOIN departments d ON d.department_id = er.department_id
      ORDER BY FIELD(er.status, 'OPEN', 'ORDERED', 'CLOSED'), er.created_at DESC LIMIT 20
    `);
    const [alerts] = await sqlPool.query(`
      SELECT a.alert_id, a.alert_type, p.name AS product_name, w.name AS warehouse_name, a.message, a.created_at
      FROM stock_alerts a JOIN products p ON p.product_id = a.product_id LEFT JOIN warehouses w ON w.warehouse_id = a.warehouse_id
      WHERE a.resolved_at IS NULL ORDER BY a.created_at DESC LIMIT 25
    `);
    const [recentMovements] = await sqlPool.query(`
      SELECT sm.movement_id, p.name AS product_name, b.batch_number, sm.movement_type, sm.quantity,
             sw.name AS source_warehouse, dw.name AS destination_warehouse, d.name AS department_name, sm.performed_by, sm.created_at
      FROM stock_movements sm JOIN products p ON p.product_id = sm.product_id
      LEFT JOIN batches b ON b.batch_id = sm.batch_id
      LEFT JOIN warehouses sw ON sw.warehouse_id = sm.source_warehouse_id
      LEFT JOIN warehouses dw ON dw.warehouse_id = sm.destination_warehouse_id
      LEFT JOIN departments d ON d.department_id = sm.destination_department_id
      ORDER BY sm.movement_id DESC LIMIT 15
    `);

    let recentEvents = [];
    let mongoEventCounts = [];
    let nosqlAvailable = false;
    try {
      const db = await getMongoDatabase();
      recentEvents = await db.collection('audit_events').find({}, {
        projection: { event_type: 1, product_id: 1, department_id: 1, quantity: 1, actor: 1, role: 1, timestamp: 1, _id: 0 }
      }).sort({ timestamp: -1 }).limit(8).toArray();
      mongoEventCounts = await db.collection('audit_events').aggregate([
        { $match: { timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: '$event_type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, event_type: '$_id', count: 1 } }
      ]).toArray();
      nosqlAvailable = true;
    } catch (mongoError) {
      console.error('MongoDB unavailable for reports:', mongoError.message);
    }

    return NextResponse.json({
      summary: summaryRows[0], lowStock, nearExpiry, supplierPerformance,
      departmentIssues, products, departments, warehouses, suppliers, purchaseOrders, openOrderItems,
      emergencyRequests, alerts, recentMovements, me: { ...auth.user, permissions: permissionsFor(auth.user.role) }, recentEvents, mongoEventCounts, nosqlAvailable
    });
  } catch (error) {
    console.error('Report endpoint failed:', error);
    return NextResponse.json({ error: `SQL report query failed: ${error.message}. Load sql/schema.sql and sql/seed.sql first.` }, { status: 500 });
  }
}
