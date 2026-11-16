USE hospital_supply_chain;

INSERT INTO departments (department_id, name, location) VALUES
(1, 'Emergency', 'Block A - Ground Floor'),
(2, 'Intensive Care Unit', 'Block A - Level 2'),
(3, 'General Ward', 'Block B - Level 1'),
(4, 'Operating Theatre', 'Block C - Level 3')
ON DUPLICATE KEY UPDATE name = VALUES(name), location = VALUES(location);

INSERT INTO suppliers (supplier_id, name, contact_name, email, phone, address, active) VALUES
(1, 'MediCore Distributors', 'Anita Rao', 'orders@medicore.example', '+91-80000-10001', 'Bengaluru, Karnataka', TRUE),
(2, 'Apex Medical Supplies', 'Vikram Shah', 'supply@apexmedical.example', '+91-80000-10002', 'Mysuru, Karnataka', TRUE),
(3, 'PharmaTrust Logistics', 'Nisha Menon', 'procurement@pharmatrust.example', '+91-80000-10003', 'Hyderabad, Telangana', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), active = VALUES(active);

INSERT INTO products (product_id, name, category, unit, unit_cost, criticality, is_active) VALUES
(101, 'Paracetamol 500 mg', 'Medicine', 'tablet', 1.80, 'MEDIUM', TRUE),
(102, 'Ceftriaxone 1 g', 'Medicine', 'vial', 42.00, 'HIGH', TRUE),
(103, 'Surgical Gloves (pair)', 'Consumable', 'pair', 8.50, 'HIGH', TRUE),
(104, 'IV Cannula 20G', 'Medical Device', 'piece', 14.00, 'HIGH', TRUE),
(105, 'Insulin Glargine', 'Medicine', 'vial', 390.00, 'CRITICAL', TRUE),
(106, 'N95 Respirator Mask', 'PPE', 'piece', 18.00, 'MEDIUM', TRUE),
(107, 'Sterile Gauze Pack', 'Consumable', 'pack', 12.00, 'MEDIUM', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category), unit_cost = VALUES(unit_cost), is_active = VALUES(is_active);

INSERT INTO warehouses (warehouse_id, name, location, storage_type) VALUES
(1, 'Central Pharmacy', 'Block A - Basement', 'Temperature controlled'),
(2, 'Emergency Store', 'Block A - Ground Floor', 'General medical storage'),
(3, 'Surgical Store', 'Block C - Level 2', 'Sterile consumables')
ON DUPLICATE KEY UPDATE name = VALUES(name), location = VALUES(location);

-- Every demo account uses the password  Demo@123  (stored only as a scrypt hash).
INSERT INTO users (user_id, full_name, username, password_hash, role, department_id, is_active) VALUES
(1, 'Demo Administrator', 'admin.demo', 'scrypt:d2c413057dd232868b0deb3ea716a8e1:3280a6d0a2407472d0b22c6dd9571a51db3d0ce962be28d167253dd79a9b5e2e473673bcd6d571d19c199b1c1d73958d4523423f900f55991ff78d45b96bf2b6', 'ADMIN', NULL, TRUE),
(2, 'Demo Procurement Officer', 'procurement.demo', 'scrypt:7731c08e819e00b514e1b63a2b6656b2:0f59eae5d2c6135c09d1d217fc5b18d8ba7bd89458d686a24ca575642ac260fef6c4dd869e296661d595a4a818a6e0a7191fe5753a68869f744a007a88ccd596', 'PROCUREMENT_OFFICER', NULL, TRUE),
(3, 'Demo Warehouse Manager', 'warehouse.demo', 'scrypt:4de719303d5f39b9a9d80a2f1af2000b:8c7628905c7a8065f953db8c0f040cca108d539ba3f8884808a8a9e9ef8edbb5813d0bc7196a20484cf4e7692f7c4e491c0e849b7f32cddf80f855b1cf66057c', 'WAREHOUSE_MANAGER', NULL, TRUE),
(4, 'Demo Emergency Staff', 'emergency.demo', 'scrypt:418a0f22e172696e797d144e2fef2a9b:0c9f05cc5f392dd60d34e95e1f0beb83cbdbe3ae88832dbb675d8125c9af9a0ef195f8aacf69797d6ffd9754028c6fefd896b76dec7674dff042a8bbd729f652', 'DEPARTMENT_STAFF', 1, TRUE)
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password_hash = VALUES(password_hash), role = VALUES(role), is_active = VALUES(is_active);

-- Inventory quantities are seeded to equal the sum of their batch quantities.
INSERT INTO inventory (product_id, warehouse_id, quantity, reorder_level) VALUES
(101, 1, 120, 120),
(101, 2, 40, 20),
(102, 1, 18, 25),
(103, 3, 900, 250),
(104, 2, 32, 40),
(105, 1, 14, 10),
(106, 3, 120, 50),
(107, 2, 28, 30)
ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), reorder_level = VALUES(reorder_level);

INSERT INTO batches (product_id, warehouse_id, batch_number, quantity, expiry_date, received_at, unit_cost) VALUES
(101, 1, 'PCM-CEN-001', 30, DATE_ADD(CURDATE(), INTERVAL 12 DAY), DATE_SUB(CURDATE(), INTERVAL 60 DAY), 1.80),
(101, 1, 'PCM-CEN-002', 70, DATE_ADD(CURDATE(), INTERVAL 180 DAY), DATE_SUB(CURDATE(), INTERVAL 12 DAY), 1.80),
-- Received AFTER PCM-CEN-001 but expires BEFORE it: FEFO picks this batch, FIFO would not.
(101, 1, 'PCM-CEN-003', 20, DATE_ADD(CURDATE(), INTERVAL 5 DAY), DATE_SUB(CURDATE(), INTERVAL 2 DAY), 1.80),
(101, 2, 'PCM-EMR-001', 40, DATE_ADD(CURDATE(), INTERVAL 150 DAY), DATE_SUB(CURDATE(), INTERVAL 20 DAY), 1.80),
(102, 1, 'CEF-CEN-001', 18, DATE_ADD(CURDATE(), INTERVAL 22 DAY), DATE_SUB(CURDATE(), INTERVAL 30 DAY), 42.00),
(103, 3, 'GLV-SRG-001', 500, DATE_ADD(CURDATE(), INTERVAL 365 DAY), DATE_SUB(CURDATE(), INTERVAL 90 DAY), 8.50),
(103, 3, 'GLV-SRG-002', 400, DATE_ADD(CURDATE(), INTERVAL 420 DAY), DATE_SUB(CURDATE(), INTERVAL 25 DAY), 8.50),
(104, 2, 'CAN-EMR-001', 32, DATE_ADD(CURDATE(), INTERVAL 45 DAY), DATE_SUB(CURDATE(), INTERVAL 18 DAY), 14.00),
(105, 1, 'INS-CEN-001', 14, DATE_ADD(CURDATE(), INTERVAL 240 DAY), DATE_SUB(CURDATE(), INTERVAL 7 DAY), 390.00),
(106, 3, 'N95-SRG-001', 120, DATE_ADD(CURDATE(), INTERVAL 300 DAY), DATE_SUB(CURDATE(), INTERVAL 14 DAY), 18.00),
(107, 2, 'GAU-EMR-001', 28, DATE_ADD(CURDATE(), INTERVAL 270 DAY), DATE_SUB(CURDATE(), INTERVAL 10 DAY), 12.00)
ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), expiry_date = VALUES(expiry_date), unit_cost = VALUES(unit_cost);

INSERT INTO purchase_orders (order_id, supplier_id, order_date, expected_date, received_date, status, total_amount, notes) VALUES
(5001, 1, DATE_SUB(CURDATE(), INTERVAL 12 DAY), DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'RECEIVED', 17400.00, 'Routine medicines replenishment'),
(5002, 2, DATE_SUB(CURDATE(), INTERVAL 8 DAY), DATE_ADD(CURDATE(), INTERVAL 2 DAY), DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'RECEIVED', 10450.00, 'Consumables order received early'),
(5003, 3, DATE_SUB(CURDATE(), INTERVAL 2 DAY), DATE_ADD(CURDATE(), INTERVAL 4 DAY), NULL, 'PENDING', 17100.00, 'Pending critical supply order'),
(5004, 1, DATE_SUB(CURDATE(), INTERVAL 25 DAY), DATE_SUB(CURDATE(), INTERVAL 18 DAY), DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'RECEIVED', 6000.00, 'Earlier on-time delivery')
ON DUPLICATE KEY UPDATE status = VALUES(status), expected_date = VALUES(expected_date), received_date = VALUES(received_date), total_amount = VALUES(total_amount);

INSERT INTO order_items (order_id, product_id, quantity_ordered, quantity_received, unit_price) VALUES
(5001, 101, 5000, 5000, 1.80),
(5001, 102, 200, 200, 42.00),
(5002, 103, 900, 900, 8.50),
(5002, 104, 200, 200, 14.00),
(5003, 105, 30, 0, 390.00),
(5003, 106, 300, 0, 18.00),
(5004, 107, 500, 500, 12.00)
ON DUPLICATE KEY UPDATE quantity_ordered = VALUES(quantity_ordered), quantity_received = VALUES(quantity_received), unit_price = VALUES(unit_price);

-- Demo usage history for the department report. These rows do not reduce seed inventory;
-- they are sample historical records only. Live allocations use the transactional API.
INSERT INTO stock_movements (movement_id, product_id, batch_id, source_warehouse_id, destination_department_id, quantity, movement_type, performed_by, reason, created_at) VALUES
(1, 101, (SELECT batch_id FROM batches WHERE batch_number = 'PCM-CEN-001'), 1, 1, 15, 'ISSUE', 'warehouse.demo', 'Emergency ward routine issue', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY)),
(2, 103, (SELECT batch_id FROM batches WHERE batch_number = 'GLV-SRG-001'), 3, 4, 120, 'ISSUE', 'warehouse.demo', 'Operating theatre consumables', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 3 DAY)),
(3, 104, (SELECT batch_id FROM batches WHERE batch_number = 'CAN-EMR-001'), 2, 2, 8, 'ISSUE', 'warehouse.demo', 'ICU line access supplies', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 5 DAY)),
(4, 102, (SELECT batch_id FROM batches WHERE batch_number = 'CEF-CEN-001'), 1, 1, 5, 'ISSUE', 'warehouse.demo', 'Emergency treatment stock', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 7 DAY)),
(5, 106, (SELECT batch_id FROM batches WHERE batch_number = 'N95-SRG-001'), 3, 3, 35, 'ISSUE', 'warehouse.demo', 'Ward PPE replenishment', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 9 DAY))
ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), reason = VALUES(reason);

-- One open urgent requirement so the emergency-procurement workflow can be demonstrated immediately.
INSERT INTO emergency_requests (request_id, product_id, department_id, quantity_needed, reason, status, requested_by)
VALUES (1, 102, 2, 40, 'ICU needs Ceftriaxone urgently; central stock is below reorder level', 'OPEN', 'emergency.demo')
ON DUPLICATE KEY UPDATE quantity_needed = VALUES(quantity_needed), status = VALUES(status);

-- Optional: quick checks after seed.
SELECT * FROM v_low_stock_inventory ORDER BY product_name;
SELECT * FROM v_near_expiry_batches ORDER BY expiry_date;
SELECT * FROM v_supplier_performance ORDER BY supplier_name;
SELECT * FROM v_department_issue_summary ORDER BY total_units_issued DESC;
