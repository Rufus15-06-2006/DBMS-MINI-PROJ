# Testing and Verification

## Automated checks in this repository

Run:

```powershell
npm test
npm run build
```

The automated Node.js tests cover password hashing/verification, role permissions, and signed-session parsing. During repository preparation, all 6 tests passed and `node --check` passed for 18 JavaScript/MJS files. A Next.js production build was attempted but could not complete in the packaging environment: the supplied dependency archive lacked the Linux SWC binary and the environment could not download it. These checks do **not** replace integration testing against MySQL and MongoDB.

## Database and application integration checklist

Run these checks on the machine used for the demonstration and record the date, environment, and result before submission.

| Area | Verification | Status |
|---|---|---|
| MySQL setup | Run `sql/schema.sql` followed by `sql/seed.sql`; verify the tables and views are created. | To verify on evaluation machine |
| MongoDB setup | Run `npm run mongo:seed`; verify the `audit_events` collection and indexes. | To verify on evaluation machine |
| Login | Sign in with each seeded demo role and confirm the session is established. | To verify on evaluation machine |
| Authorization | Attempt permitted and forbidden actions for each role; verify the API rejects forbidden actions. | To verify on evaluation machine |
| FEFO allocation | Allocate stock and verify the earliest-expiring eligible batch is consumed first. | To verify on evaluation machine |
| Shortage handling | Request more than available eligible stock; verify issued quantity, shortfall, SQL alert/request, and audit event. | To verify on evaluation machine |
| Purchase orders | Create an order, receive part/all of it, and verify order status, batch, inventory, and movement records. | To verify on evaluation machine |
| Transfers | Transfer between warehouses and verify source/destination inventory, batches, expiry, and movement ledger. | To verify on evaluation machine |
| Expiry maintenance | Run expiry scan and expired-stock write-off; verify alerts and adjustment movements. | To verify on evaluation machine |
| Reports | Compare dashboard/report rows with SQL queries in `sql/reports.sql`. | To verify on evaluation machine |
| MongoDB audit | Verify state-changing demo actions appear in `audit_events`; run `mongodb/aggregation_examples.js`. | To verify on evaluation machine |

## Important limitations

- SQL transactions and MongoDB audit writes are separate operations, not a distributed atomic transaction.
- The included screenshots are evidence supplied for the demo; they are not proof that every integration scenario in the checklist has been rerun on the final submission machine.
- Only report integration tests as passed after running them against the configured databases.
