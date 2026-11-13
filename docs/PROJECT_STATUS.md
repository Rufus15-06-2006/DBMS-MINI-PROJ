# Project Status — Hospital Supply Chain Management

**Team:** Rohit Chaki (PES1UG24AM228), Rufus Thomas (PES1UG24AM232)

| Lab / evaluation area | Implementation evidence | Status note |
|---|---|---|
| ER model | `docs/ER_Diagram.png` (team-supplied simplified diagram) and `docs/ER_Diagram_Detailed.png` (implementation-oriented diagram) | The supplied presentation diagram omits `emergency_requests`; the detailed diagram and `sql/schema.sql` document the full implementation. |
| Relational database | 12 MySQL tables, PK/FK relationships, CHECK constraints, indexes, views, triggers, and procedures in `sql/schema.sql` | Implemented in source; verify against the evaluation MySQL instance. |
| RDBMS + NoSQL | MySQL (`sql/`, `lib/mysql.js`) and MongoDB `audit_events` (`mongodb/`, `lib/audit.js`) | Implemented in source. |
| Advanced DBMS concepts | Transactions, five triggers, three stored procedures, four views, indexes, CHECK constraints, and MongoDB aggregation | Implemented in source. |
| Authentication and authorization | `lib/security.js`, `lib/auth.js`, `app/api/auth/*`; four roles and API-side permission checks | Unit-tested for password hashing/session parsing and permission matrix. Complete role-by-role API tests on the demo machine. |
| Reports | Dashboard and `sql/reports.sql` | Screenshots in `docs/screenshots/`; compare with a fresh local seed before evaluation. |
| Application | Next.js frontend and API routes under `app/` | Included in repository. |
| Documentation and evidence | README, demo runbook, expected results, viva notes, testing checklist, contribution template, screenshots, PDF/DOCX report | Included in repository. |

## Verification performed while preparing this repository

- `npm test`: passed (6 automated tests covering salted scrypt password hashes, role permissions, and session parsing).
- `node --check`: passed for 18 JavaScript / MJS files under `lib/`, `mongodb/`, `scripts/`, `tests/`, and `app/api/`.
- Next.js production build: not confirmed in the packaging environment. The archived dependencies did not include the Linux SWC binary, and the attempted download was blocked by unavailable network access. Run `npm ci` followed by `npm run build` on the submission machine.
- MySQL and MongoDB integration: not run in this packaging environment; complete the checklist in `TESTING.md` on the evaluation machine.

## Known limitations

- SQL and MongoDB writes are not one atomic distributed transaction.
- No HTTPS, password reset, or production-grade account lockout; throttling is in-memory per username.
- Demand forecasting, predictive replenishment, and storage-condition monitoring remain future scope.
- This is an academic demonstration using synthetic data, not a production hospital system.
