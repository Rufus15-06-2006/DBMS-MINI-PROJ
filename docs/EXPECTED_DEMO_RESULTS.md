# Expected Results After a Fresh Seed

Run `schema.sql` then `seed.sql`. Dates are relative to `CURDATE()`. Password for all demo users: `Demo@123`.

## Dashboard metrics
Active products 7 · low-stock records 4 · near-expiry batches 4 · open purchase orders 1 · open emergency requests 1 · unresolved alerts 4 (the four LOW_STOCK alerts raised by the insert trigger while seeding).

## Low stock
| Product | Warehouse | On hand | Reorder |
|---|---|---:|---:|
| Paracetamol 500 mg | Central Pharmacy | 120 | 120 |
| Ceftriaxone 1 g | Central Pharmacy | 18 | 25 |
| IV Cannula 20G | Emergency Store | 32 | 40 |
| Sterile Gauze Pack | Emergency Store | 28 | 30 |

## Near-expiry batches
PCM-CEN-003 (20 units, 5 days) · PCM-CEN-001 (30, 12 days) · CEF-CEN-001 (18, 22 days) · CAN-EMR-001 (32, 45 days).

## Supplier performance
MediCore 2 received, 1 on time (50%) · Apex 1 received, on time (100%) · PharmaTrust 1 pending, no percentage yet.

## Purchase-order totals (maintained by trigger = sum of lines)
5001 → 17,400 · 5002 → 10,450 · 5003 → 17,100 · 5004 → 6,000.

## Department issues this month
Emergency 20 units (2 records) · ICU 8 · General Ward 35 · Operating Theatre 120. (If you seed on the 1st–9th of a month, some history rows fall in the previous month and the totals shrink.)

## Key demonstrations
- **FEFO ≠ FIFO:** allocate Paracetamol (101), Emergency, qty 10. `PCM-CEN-003` (received 2 days ago, expires in 5 days) is used. FIFO would have used `PCM-CEN-001`, the oldest received batch.
- **Trigger:** allocate Insulin Glargine (105), qty 5. Central Pharmacy stock falls 14 → 9 (reorder level 10) and a new LOW_STOCK alert appears.
- **Shortage → emergency procurement:** allocate Paracetamol qty 200. 160 eligible units exist, so 40 are short; an EMERGENCY_SHORTAGE alert and an OPEN emergency request are created.
