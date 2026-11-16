# DBMS Viva Cheat Sheet — Hospital Supply Chain Management

## Likely project questions

**Why use MySQL?**
The core data is structured, related by keys and updated in multi-step operations. Foreign keys and transactions help prevent invalid references and partially applied stock changes.

**Why use MongoDB?**
Audit events vary in detail. One event may include allocation-by-batch data; another may include order metadata or an expiry review. A document can carry event-specific fields without altering a fixed relational table for every event shape.

**What is the primary key in `inventory`?**
A composite key: (`product_id`, `warehouse_id`). It allows one product to be stocked separately at multiple warehouses without duplicate rows for the same product/warehouse pair.

**Why is `order_items` needed?**
A purchase order can contain many products and each product can appear in many orders. `order_items` implements the many-to-many relationship and stores quantity and agreed unit price for each line.

**What does the low-stock trigger do?**
It inserts a row into `stock_alerts` when inventory is inserted already below the reorder level, or when an update crosses from above the threshold to at/below it. Stock already below its reorder level (e.g. seeded Paracetamol) does not fire it again; use Insulin (product 105, quantity 5) to demonstrate.

**What is a view?**
A named query that presents derived rows. For example, `v_near_expiry_batches` joins batches, products and warehouses and filters to nonzero quantities expiring within 60 days.

**Why use a stored procedure?**
`sp_create_purchase_order` encapsulates purchase-order creation behind a database routine callable with SQL `CALL` syntax.

**What is the transaction in the allocation API?**
The application begins a transaction, locks eligible batches, reduces batch and inventory balances, inserts movement rows and shortage alerts as needed, then commits. On failure it rolls back SQL writes.

**What is FEFO and how is it different from FIFO?**
FEFO (First-Expiry-First-Out) prioritizes the batch with the earliest expiry date. FIFO prioritizes the oldest received batch. They can differ if an older batch expires later than a newer batch.

**What happens if inventory is insufficient?**
The workflow issues the available eligible stock, returns the remaining shortfall, and creates an `EMERGENCY_SHORTAGE` SQL alert. The audit event captures requested, issued and shortfall quantities.

**Are SQL and MongoDB changes atomic together?**
No. In this demo, the SQL transaction commits first, then the audit document is attempted. This avoids falsely claiming distributed atomicity; production should add an outbox/retry strategy.

**What is an index and why use one here?**
An index helps the database find rows without scanning the whole table. Expiry, product names, stock levels, supplier/order dates and movement timestamps are frequently filtered or sorted.

**What is the project's novelty?**
The demonstrable workflow combines expiry-aware batch selection, cross-warehouse eligible-stock allocation, transactional inventory updates, shortage alerting and a MongoDB audit record in one emergency request process. Present it as a project-specific integration and rule set, not as a claim that FEFO itself is new to healthcare.

## Additions in v2

**How is authentication implemented?** Passwords are stored as salted scrypt hashes (`users.password_hash`). Login issues an HMAC-signed, HttpOnly cookie containing user id, role and expiry. Every API route calls `authorize(request, action)`, which checks the signature and the role against the permission matrix. The UI hides forbidden actions, but the server enforces them.

**Which roles exist and what can they do?** Admin (everything), Procurement Officer (orders, emergency orders, receiving), Warehouse Manager (issue, transfer, receive, expiry tasks), Department Staff (issue/request for their own department only).

**How does emergency procurement work?** A shortfall in FEFO allocation inserts an `EMERGENCY_SHORTAGE` alert and an OPEN `emergency_requests` row inside the same transaction. A procurement officer converts it into a purchase order (calls `sp_create_purchase_order`); receiving that order closes the request.

**How do transfers keep expiry correct?** Source batches are locked and consumed FEFO; the destination gets a batch with the same expiry and received date, so FEFO still works there. Everything is one transaction, and a transfer larger than eligible stock is rejected with nothing changed.

**Why is `total_amount` safe to store?** It is a derived value, so three triggers on `order_items` recompute it after insert, update and delete.

**What does `sp_write_off_expired` do?** In one transaction it logs an ADJUSTMENT movement per expired batch, reduces the warehouse summary, resolves the batch's alert and zeroes the batch.

**Is the schema normalized?** Tables are in 3NF except two deliberate derived values: `inventory.quantity` (sum of batch quantities) and `purchase_orders.total_amount`. The first is kept consistent by the transactional APIs, the second by triggers.

**ACID in your project?** Atomicity: rollback on any failure. Consistency: FK/CHECK constraints plus guarded updates (`quantity >= ?`). Isolation: `FOR UPDATE` row locks on batches. Durability: InnoDB commit.

## Quick SQL checks

```sql
SELECT * FROM v_low_stock_inventory;
SELECT * FROM v_near_expiry_batches;
SELECT * FROM v_supplier_performance;
SELECT * FROM v_department_issue_summary;
SELECT alert_id, alert_type, message, created_at FROM stock_alerts ORDER BY created_at DESC;
```
