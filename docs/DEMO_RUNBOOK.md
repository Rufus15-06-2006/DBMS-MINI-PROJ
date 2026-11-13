# Status Evaluation — 7 to 8 Minute Demo Runbook

Prepare: MySQL and MongoDB running, `npm run dev`, ER diagram open in a second tab. Start signed out.

1. **Problem (30 s).** Stock-outs interrupt care; overstock expires. One system covers inventory, suppliers, orders, warehouses, expiry, emergencies and access control.
2. **ER diagram (45 s).** Explain the supplied conceptual diagram, then use `ER_Diagram_Detailed.png` / `sql/schema.sql` for full implementation coverage. The implemented schema has 12 tables; the supplied presentation diagram does not show `emergency_requests`, which links shortages to procurement. `inventory` has a composite PK; `order_items` resolves purchase_orders ↔ products; product batches carry expiry dates. MongoDB `audit_events` sits outside the relational model.
3. **Authentication and roles (45 s).** Sign in as `emergency.demo` (Department Staff): the department is locked to Emergency and Procurement/Transfers are disabled. Sign out, sign in as `admin.demo`. Mention scrypt-hashed passwords and the permission matrix in `lib/auth.js`.
4. **Reports (60 s).** Dashboard: low stock, near expiry, supplier on-time %, department issues, MongoDB aggregation.
5. **FEFO allocation (75 s).** Allocate stock → Paracetamol, Emergency, 10. Show in the ledger that batch `PCM-CEN-003` was used (expires soonest although received most recently: this is where FEFO differs from FIFO). Then allocate 200 to show the shortfall, alert and automatic emergency request.
6. **Procurement and emergency flow (75 s).** Emergency tab → *Create PO* on the open request (as admin or `procurement.demo`). Procurement tab → receive that PO into a warehouse with an expiry date; show status RECEIVED, the new batch, the RECEIPT movement, and the request becoming CLOSED.
7. **Transfer (30 s).** Transfers tab: move 10 units of a product between warehouses; show TRANSFER ledger row.
8. **Advanced DBMS features (60 s).** Trigger (allocate Insulin 5 → LOW_STOCK alert), views, three procedures, transactions in `allocate/route.js`, Mongo aggregation.

## Optional expiry demo
```sql
UPDATE batches SET expiry_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE batch_number = 'CEF-CEN-001';
```
Alerts tab → *Write off expired batches*; Ceftriaxone drops to 0 and an ADJUSTMENT movement is logged. Alerts tab → *Run expiry scan* raises NEAR_EXPIRY alerts.

## If something fails
- Login fails: confirm `schema.sql` and `seed.sql` were both run (the seed contains the password hashes) and that `AUTH_SECRET` is set in `.env`.
- SQL errors: check `.env` credentials; re-run schema then seed.
- MongoDB offline: SQL features still work; the header says MongoDB is unavailable. Start MongoDB and run `npm run mongo:seed`.
- Only claim what you have verified running on the evaluation machine.
