-- Hospital Supply Chain Management System
-- MySQL 8.0.16+ required (CHECK constraints are enforced from 8.0.16). Run this before seed.sql.
-- This is a synthetic-data demo database: the next line rebuilds it from scratch every run.
DROP DATABASE IF EXISTS hospital_supply_chain;
CREATE DATABASE IF NOT EXISTS hospital_supply_chain
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE hospital_supply_chain;

CREATE TABLE IF NOT EXISTS departments (
  department_id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  location VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS suppliers (
  supplier_id INT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  contact_name VARCHAR(120) NULL,
  email VARCHAR(180) NULL,
  phone VARCHAR(30) NULL,
  address VARCHAR(255) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  product_id INT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(80) NOT NULL,
  unit VARCHAR(30) NOT NULL DEFAULT 'unit',
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  criticality ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_products_name (name),
  INDEX idx_products_category (category)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS warehouses (
  warehouse_id INT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  location VARCHAR(180) NULL,
  storage_type VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  user_id INT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,  -- scrypt:<salt>:<hash>; never store plain-text passwords
  role ENUM('ADMIN','PROCUREMENT_OFFICER','WAREHOUSE_MANAGER','DEPARTMENT_STAFF') NOT NULL,
  department_id INT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments(department_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- One row per product in one warehouse. Batch balances are maintained in batches.
CREATE TABLE IF NOT EXISTS inventory (
  product_id INT NOT NULL,
  warehouse_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reorder_level INT NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  last_updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, warehouse_id),
  INDEX idx_inventory_stock_threshold (quantity, reorder_level),
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS batches (
  batch_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  warehouse_id INT NOT NULL,
  batch_number VARCHAR(80) NOT NULL UNIQUE,
  quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  expiry_date DATE NOT NULL,
  received_at DATE NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  INDEX idx_batches_expiry (expiry_date, product_id, warehouse_id),
  CONSTRAINT fk_batches_product FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_batches_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_orders (
  order_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT NOT NULL,
  order_date DATE NOT NULL,
  expected_date DATE NOT NULL,
  received_date DATE NULL,
  status ENUM('PENDING','PARTIAL','RECEIVED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_purchase_orders_supplier_date (supplier_id, order_date),
  CONSTRAINT fk_purchase_orders_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity_ordered INT NOT NULL CHECK (quantity_ordered > 0),
  quantity_received INT NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  UNIQUE KEY uq_order_product (order_id, product_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES purchase_orders(order_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_movements (
  movement_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  batch_id INT NULL,
  source_warehouse_id INT NULL,
  destination_department_id INT NULL,
  destination_warehouse_id INT NULL,   -- used by TRANSFER (target) and RECEIPT (where goods were stored)
  quantity INT NOT NULL CHECK (quantity > 0),
  movement_type ENUM('ISSUE','TRANSFER','RECEIPT','ADJUSTMENT') NOT NULL,
  performed_by VARCHAR(100) NOT NULL,
  reason VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stock_movements_dept_date (destination_department_id, created_at),
  INDEX idx_stock_movements_product_date (product_id, created_at),
  CONSTRAINT fk_movements_product FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_movements_batch FOREIGN KEY (batch_id) REFERENCES batches(batch_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_movements_warehouse FOREIGN KEY (source_warehouse_id) REFERENCES warehouses(warehouse_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_movements_department FOREIGN KEY (destination_department_id) REFERENCES departments(department_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_movements_dest_warehouse FOREIGN KEY (destination_warehouse_id) REFERENCES warehouses(warehouse_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- Urgent requirements. Created manually or automatically when an allocation cannot be fully met.
CREATE TABLE IF NOT EXISTS emergency_requests (
  request_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  department_id INT NULL,
  quantity_needed INT NOT NULL CHECK (quantity_needed > 0),
  reason VARCHAR(255) NOT NULL,
  status ENUM('OPEN','ORDERED','CLOSED') NOT NULL DEFAULT 'OPEN',
  requested_by VARCHAR(100) NOT NULL,
  order_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_emergency_status (status, created_at),
  CONSTRAINT fk_emergency_product FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_emergency_department FOREIGN KEY (department_id) REFERENCES departments(department_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_emergency_order FOREIGN KEY (order_id) REFERENCES purchase_orders(order_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_alerts (
  alert_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  warehouse_id INT NULL,
  alert_type ENUM('LOW_STOCK','NEAR_EXPIRY','EMERGENCY_SHORTAGE') NOT NULL,
  message VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  INDEX idx_alerts_type_created (alert_type, created_at),
  CONSTRAINT fk_alerts_product FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_alerts_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE OR REPLACE VIEW v_low_stock_inventory AS
SELECT i.product_id, p.name AS product_name, i.warehouse_id, w.name AS warehouse_name,
       i.quantity, i.reorder_level
FROM inventory i
JOIN products p ON p.product_id = i.product_id
JOIN warehouses w ON w.warehouse_id = i.warehouse_id
WHERE p.is_active = TRUE AND i.quantity <= i.reorder_level;

CREATE OR REPLACE VIEW v_near_expiry_batches AS
SELECT b.batch_id, b.product_id, p.name AS product_name, b.batch_number,
       b.warehouse_id, w.name AS warehouse_name, b.quantity, b.expiry_date
FROM batches b
JOIN products p ON p.product_id = b.product_id
JOIN warehouses w ON w.warehouse_id = b.warehouse_id
WHERE b.quantity > 0
  AND b.expiry_date >= CURDATE()
  AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 60 DAY);

CREATE OR REPLACE VIEW v_department_issue_summary AS
SELECT d.department_id, d.name AS department_name,
       COUNT(sm.movement_id) AS issue_count,
       COALESCE(SUM(sm.quantity), 0) AS total_units_issued
FROM departments d
LEFT JOIN stock_movements sm
  ON sm.destination_department_id = d.department_id
  AND sm.movement_type = 'ISSUE'
  AND sm.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
  AND sm.created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
GROUP BY d.department_id, d.name;

CREATE OR REPLACE VIEW v_supplier_performance AS
SELECT s.supplier_id, s.name AS supplier_name,
       COUNT(po.order_id) AS total_orders,
       SUM(CASE WHEN po.status = 'RECEIVED' THEN 1 ELSE 0 END) AS received_orders,
       SUM(CASE WHEN po.status = 'RECEIVED' AND po.received_date <= po.expected_date THEN 1 ELSE 0 END) AS on_time_orders,
       ROUND(100.0 * SUM(CASE WHEN po.status = 'RECEIVED' AND po.received_date <= po.expected_date THEN 1 ELSE 0 END)
         / NULLIF(SUM(CASE WHEN po.status = 'RECEIVED' THEN 1 ELSE 0 END), 0), 1) AS on_time_pct,
       ROUND(AVG(CASE WHEN po.received_date IS NOT NULL THEN DATEDIFF(po.received_date, po.order_date) END), 1) AS avg_days_to_receive
FROM suppliers s
LEFT JOIN purchase_orders po ON po.supplier_id = s.supplier_id
GROUP BY s.supplier_id, s.name;

DROP TRIGGER IF EXISTS trg_inventory_low_stock_insert;
DROP TRIGGER IF EXISTS trg_inventory_low_stock_update;
DELIMITER $$
CREATE TRIGGER trg_inventory_low_stock_insert
AFTER INSERT ON inventory
FOR EACH ROW
BEGIN
  IF NEW.quantity <= NEW.reorder_level THEN
    INSERT INTO stock_alerts (product_id, warehouse_id, alert_type, message)
    VALUES (NEW.product_id, NEW.warehouse_id, 'LOW_STOCK',
      CONCAT('Initial stock is ', NEW.quantity, '; reorder level is ', NEW.reorder_level, '.'));
  END IF;
END$$

CREATE TRIGGER trg_inventory_low_stock_update
AFTER UPDATE ON inventory
FOR EACH ROW
BEGIN
  IF OLD.quantity > OLD.reorder_level AND NEW.quantity <= NEW.reorder_level THEN
    INSERT INTO stock_alerts (product_id, warehouse_id, alert_type, message)
    VALUES (NEW.product_id, NEW.warehouse_id, 'LOW_STOCK',
      CONCAT('Stock reached ', NEW.quantity, '; reorder level is ', NEW.reorder_level, '.'));
  END IF;
END$$

DROP PROCEDURE IF EXISTS sp_create_purchase_order$$
CREATE PROCEDURE sp_create_purchase_order(
  IN p_supplier_id INT,
  IN p_expected_date DATE,
  OUT p_order_id INT
)
BEGIN
  INSERT INTO purchase_orders (supplier_id, order_date, expected_date, status, total_amount, notes)
  VALUES (p_supplier_id, CURDATE(), p_expected_date, 'PENDING', 0, 'Created through sp_create_purchase_order');
  SET p_order_id = LAST_INSERT_ID();
END$$

-- Keep purchase_orders.total_amount (a derived value) consistent with its order_items.
DROP TRIGGER IF EXISTS trg_order_items_total_ai$$
DROP TRIGGER IF EXISTS trg_order_items_total_au$$
DROP TRIGGER IF EXISTS trg_order_items_total_ad$$
CREATE TRIGGER trg_order_items_total_ai AFTER INSERT ON order_items FOR EACH ROW
  UPDATE purchase_orders SET total_amount =
    (SELECT COALESCE(SUM(quantity_ordered * unit_price), 0) FROM order_items WHERE order_id = NEW.order_id)
  WHERE order_id = NEW.order_id$$
CREATE TRIGGER trg_order_items_total_au AFTER UPDATE ON order_items FOR EACH ROW
  UPDATE purchase_orders SET total_amount =
    (SELECT COALESCE(SUM(quantity_ordered * unit_price), 0) FROM order_items WHERE order_id = NEW.order_id)
  WHERE order_id = NEW.order_id$$
CREATE TRIGGER trg_order_items_total_ad AFTER DELETE ON order_items FOR EACH ROW
  UPDATE purchase_orders SET total_amount =
    (SELECT COALESCE(SUM(quantity_ordered * unit_price), 0) FROM order_items WHERE order_id = OLD.order_id)
  WHERE order_id = OLD.order_id$$

-- Expiry monitoring: raise one NEAR_EXPIRY alert per batch expiring within 60 days (no duplicates).
DROP PROCEDURE IF EXISTS sp_refresh_expiry_alerts$$
CREATE PROCEDURE sp_refresh_expiry_alerts(OUT p_created INT)
BEGIN
  INSERT INTO stock_alerts (product_id, warehouse_id, alert_type, message)
  SELECT b.product_id, b.warehouse_id, 'NEAR_EXPIRY',
         CONCAT('Batch ', b.batch_number, ' (', b.quantity, ' units) expires on ', b.expiry_date)
  FROM batches b
  WHERE b.quantity > 0
    AND b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
    AND NOT EXISTS (
      SELECT 1 FROM stock_alerts a
      WHERE a.alert_type = 'NEAR_EXPIRY' AND a.resolved_at IS NULL
        AND a.product_id = b.product_id
        AND a.message LIKE CONCAT('Batch ', b.batch_number, ' (%'));
  SET p_created = ROW_COUNT();
END$$

-- Remove expired stock from sellable inventory. Writes an ADJUSTMENT movement per batch, reduces the
-- warehouse summary, zeroes the batch, and resolves its NEAR_EXPIRY alert. All-or-nothing.
DROP PROCEDURE IF EXISTS sp_write_off_expired$$
CREATE PROCEDURE sp_write_off_expired(IN p_user VARCHAR(100), OUT p_batches INT)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  START TRANSACTION;
  INSERT INTO stock_movements (product_id, batch_id, source_warehouse_id, quantity, movement_type, performed_by, reason)
  SELECT product_id, batch_id, warehouse_id, quantity, 'ADJUSTMENT', p_user, 'Expired batch write-off'
  FROM batches WHERE expiry_date < CURDATE() AND quantity > 0;
  SET p_batches = ROW_COUNT();
  UPDATE inventory i
  JOIN (SELECT product_id, warehouse_id, SUM(quantity) AS q FROM batches
        WHERE expiry_date < CURDATE() AND quantity > 0 GROUP BY product_id, warehouse_id) e
    ON e.product_id = i.product_id AND e.warehouse_id = i.warehouse_id
  SET i.quantity = GREATEST(i.quantity - e.q, 0);
  UPDATE stock_alerts a JOIN batches b ON a.message LIKE CONCAT('Batch ', b.batch_number, ' (%')
    AND a.product_id = b.product_id
  SET a.resolved_at = CURRENT_TIMESTAMP
  WHERE a.alert_type = 'NEAR_EXPIRY' AND a.resolved_at IS NULL AND b.expiry_date < CURDATE();
  UPDATE batches SET quantity = 0 WHERE expiry_date < CURDATE() AND quantity > 0;
  COMMIT;
END$$
DELIMITER ;

-- Concepts demonstrated: PK/FK constraints, CHECK constraints, indexes, views, five triggers,
-- three stored procedures, transactional allocation/transfer/receipt APIs, MongoDB aggregation.
