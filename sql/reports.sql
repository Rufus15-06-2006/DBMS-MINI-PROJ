USE hospital_supply_chain;

-- Report 1: products at or below reorder threshold.
SELECT product_name, warehouse_name, quantity, reorder_level
FROM v_low_stock_inventory
ORDER BY quantity ASC;

-- Report 2: batches expiring within the next 60 days.
SELECT product_name, batch_number, warehouse_name, quantity, expiry_date,
       DATEDIFF(expiry_date, CURDATE()) AS days_to_expiry
FROM v_near_expiry_batches
ORDER BY expiry_date ASC;

-- Report 3: supplier delivery performance.
SELECT supplier_name, total_orders, received_orders, on_time_orders,
       on_time_pct, avg_days_to_receive
FROM v_supplier_performance
ORDER BY on_time_pct DESC, total_orders DESC;

-- Report 4: departmental stock issued this calendar month.
SELECT department_name, issue_count, total_units_issued
FROM v_department_issue_summary
ORDER BY total_units_issued DESC;

-- Report 5: current inventory value by warehouse.
SELECT w.name AS warehouse_name,
       SUM(i.quantity) AS total_units,
       ROUND(SUM(i.quantity * p.unit_cost), 2) AS inventory_value
FROM inventory i
JOIN warehouses w ON w.warehouse_id = i.warehouse_id
JOIN products p ON p.product_id = i.product_id
GROUP BY w.warehouse_id, w.name
ORDER BY inventory_value DESC;

-- Report 6: procurement order line summary.
SELECT po.order_id, s.name AS supplier_name, po.status, po.order_date,
       po.expected_date, po.received_date,
       SUM(oi.quantity_ordered) AS units_ordered,
       SUM(oi.quantity_received) AS units_received,
       ROUND(SUM(oi.quantity_ordered * oi.unit_price), 2) AS order_line_value
FROM purchase_orders po
JOIN suppliers s ON s.supplier_id = po.supplier_id
JOIN order_items oi ON oi.order_id = po.order_id
GROUP BY po.order_id, s.name, po.status, po.order_date, po.expected_date, po.received_date
ORDER BY po.order_date DESC;

-- Report 7: stock alerts requiring attention.
SELECT a.alert_id, p.name AS product_name, w.name AS warehouse_name,
       a.alert_type, a.message, a.created_at, a.resolved_at
FROM stock_alerts a
JOIN products p ON p.product_id = a.product_id
LEFT JOIN warehouses w ON w.warehouse_id = a.warehouse_id
WHERE a.resolved_at IS NULL
ORDER BY a.created_at DESC;

-- Report 8: purchase-order totals must equal the sum of their lines (enforced by trigger).
SELECT po.order_id, po.total_amount,
       SUM(oi.quantity_ordered * oi.unit_price) AS computed_total
FROM purchase_orders po JOIN order_items oi ON oi.order_id = po.order_id
GROUP BY po.order_id, po.total_amount;

-- Report 9: open emergency procurement requests.
SELECT er.request_id, p.name AS product_name, d.name AS department_name,
       er.quantity_needed, er.status, er.requested_by, er.order_id, er.created_at
FROM emergency_requests er
JOIN products p ON p.product_id = er.product_id
LEFT JOIN departments d ON d.department_id = er.department_id
ORDER BY FIELD(er.status, 'OPEN', 'ORDERED', 'CLOSED'), er.created_at DESC;

-- Report 10: stock movement ledger by type (ISSUE, TRANSFER, RECEIPT, ADJUSTMENT).
SELECT movement_type, COUNT(*) AS movements, SUM(quantity) AS units
FROM stock_movements GROUP BY movement_type;
