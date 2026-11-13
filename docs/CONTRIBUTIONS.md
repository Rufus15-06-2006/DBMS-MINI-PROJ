# Team Contributions

**Project:** Hospital Supply Chain Management System  
**Course:** DBMS Experiential Learning – Level 3

## Team members

| Team member | SRN |
|---|---|
| Rohit Chaki | PES1UG24AM228 |
| Rufus Thomas | PES1UG24AM232 |

## Proposed division of responsibilities

The responsibilities below are the proposed module-based ownership split agreed for documenting the project. Both members must verify that the listed work accurately reflects what they personally designed, implemented, tested, or documented before this file is used as a formal contribution declaration. Update the descriptions if the actual work differs.

### Rohit Chaki — Application, security, and operational workflows

**Frontend and dashboard**
- Lead the Next.js dashboard and user interface in `app/page.js`, `app/layout.js`, and `app/globals.css`.
- Present inventory status, low-stock and near-expiry information, procurement status, department issues, and audit-event summaries.

**Authentication and authorization**
- Lead implementation/review of login, logout, and session identity endpoints under `app/api/auth/`.
- Implement/review password hashing, signed session handling, role permissions, and authorization helpers in `lib/security.js` and `lib/auth.js`.
- Verify that protected API operations enforce permissions on the server.

**Inventory and stock movement workflows**
- Lead implementation/review of expiry-aware FEFO allocation and shortage handling in `app/api/allocate/route.js`.
- Lead implementation/review of warehouse transfers in `app/api/transfers/route.js`.
- Lead implementation/review of emergency requests and conversion of requests into procurement actions in `app/api/emergency/route.js`.

**Application/database integration and security tests**
- Maintain/review application connection and integration helpers in `lib/mysql.js`, `lib/mongo.js`, and `lib/audit.js`.
- Maintain/review authentication and permission unit tests in `tests/auth.test.js` and validate the application's configuration handling.

### Rufus Thomas — Database design and data-centric workflows

**Relational database design**
- Design and review the ER model, entities, relationships, keys, and constraints.
- Lead the MySQL schema implementation in `sql/schema.sql`, including tables, primary/foreign keys, uniqueness and check constraints, indexes, views, stored procedures, and triggers.
- Validate relational integrity and the relationship between aggregate inventory and batch quantities.

**SQL data and reporting**
- Prepare and validate synthetic data in `sql/seed.sql`.
- Develop and verify reporting queries in `sql/reports.sql`, including low-stock, near-expiry, supplier-performance, and department-issue reporting.
- Capture or verify representative SQL outputs for the report and evaluation demonstration.

**MongoDB data layer**
- Own the audit-event seed examples, collection indexes, and aggregation examples in `mongodb/seed.js` and `mongodb/aggregation_examples.js`.
- Verify the shape and expected results of the demonstration audit documents and aggregation pipelines.

**Database-heavy application workflows**
- Lead implementation/review of purchase-order creation and receiving in `app/api/purchase-orders/route.js`.
- Lead implementation/review of expiry scanning and expired-stock write-off in `app/api/maintenance/route.js`.
- Lead implementation/review of database-backed dashboard/report queries in `app/api/reports/route.js`.

## Joint responsibilities

Both members contribute to and are accountable for:
- Requirements analysis, scope decisions, and review of the overall architecture.
- Integration of the Next.js application with MySQL and MongoDB.
- End-to-end testing of allocation, transfers, procurement, expiry handling, authentication, authorization, and reporting.
- Reviewing the ER diagram, relational schema, SQL/NoSQL outputs, screenshots, and final report for consistency.
- Preparing the demonstration, explaining the complete system, and answering viva questions.
- Reviewing each other's code and maintaining the shared GitHub repository.

## Evidence to attach or verify before submission

| Contribution area | Repository evidence to reference |
|---|---|
| Rohit — frontend and dashboard | `app/page.js`, `app/layout.js`, `app/globals.css` |
| Rohit — authentication and security | `app/api/auth/`, `lib/auth.js`, `lib/security.js`, `tests/auth.test.js` |
| Rohit — allocation, transfer, emergency workflows | `app/api/allocate/route.js`, `app/api/transfers/route.js`, `app/api/emergency/route.js` |
| Rohit — app/database integration | `lib/mysql.js`, `lib/mongo.js`, `lib/audit.js` |
| Rufus — relational design and SQL | `sql/schema.sql`, `sql/seed.sql`, `sql/reports.sql`, `docs/ER_Diagram.png`, `docs/ER_Diagram_Detailed.*` |
| Rufus — MongoDB examples | `mongodb/seed.js`, `mongodb/aggregation_examples.js` |
| Rufus — procurement, maintenance, reporting | `app/api/purchase-orders/route.js`, `app/api/maintenance/route.js`, `app/api/reports/route.js` |
| Joint — report, test evidence, demo | `report/`, `docs/TESTING.md`, `docs/DEMO_RUNBOOK.md`, `docs/screenshots/` |

For the final submission, add actual commit hashes or pull-request links beside the relevant areas where they exist. A file being present in the shared repository is evidence of project implementation, but does not by itself prove which member authored it. Do not invent commit history or claim work that the named member did not perform.

## GitHub collaboration

Both members should use their own GitHub accounts for their genuine future changes. Make focused commits for work actually performed, review the other's pull requests where practical, and retain the shared repository history.

If the initial project upload is made as one commit by one account, that initial commit does not demonstrate an individual contribution split. This document records the proposed module ownership; subsequent authentic commits and the team's explanation provide additional evidence.

## Final verification

Before submission, both members should:
1. Confirm that the proposed responsibilities match the work actually completed.
2. Add commit hashes or pull-request links only where the history supports the attribution.
3. Correct or remove any task that was not performed by the named member.
4. Be prepared to explain the complete system, including areas primarily handled by the other member.
