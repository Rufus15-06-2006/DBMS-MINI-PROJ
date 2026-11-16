'use client';

import { useCallback, useEffect, useState } from 'react';

const number = (v) => new Intl.NumberFormat('en-IN').format(Number(v || 0));
const money = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(v || 0));
const date = (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—';
const stamp = (v) => v ? new Date(v).toLocaleString('en-IN') : '—';
const futureDate = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
const ROLE_LABEL = { ADMIN: 'Administrator', PROCUREMENT_OFFICER: 'Procurement Officer', WAREHOUSE_MANAGER: 'Warehouse Manager', DEPARTMENT_STAFF: 'Department Staff' };

async function api(url, options = {}) {
  const res = await fetch(url, { cache: 'no-store', ...options });
  let json = {};
  try { json = await res.json(); } catch {}
  if (!res.ok) { const e = new Error(json.error || `Request failed (${res.status}).`); e.status = res.status; throw e; }
  return json;
}
const post = (url, body) => api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function DataTable({ title, columns, rows, empty = 'No records to display.' }) {
  return (
    <section className="panel">
      <div className="panel-heading"><h2>{title}</h2><span className="muted">{rows?.length || 0} records</span></div>
      {!rows?.length ? <p className="empty">{empty}</p> : (
        <div className="table-wrap"><table><thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
          <tbody>{rows.map((row, i) => <tr key={i}>{columns.map((c) => <td key={c.key}>{c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}</td>)}</tr>)}</tbody></table></div>
      )}
    </section>
  );
}

const Badge = ({ value }) => <span className={`badge badge-${String(value).toLowerCase()}`}>{String(value).replace('_', ' ')}</span>;
const Locked = ({ what }) => <p className="empty">Your role does not allow you to {what}. Ask an administrator if you need access.</p>;

function Login({ onLoggedIn }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { await post('/api/auth/login', form); onLoggedIn(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <main className="shell login-shell">
      <section className="panel login-panel">
        <p className="eyebrow">DBMS LAB PROJECT</p>
        <h1>Hospital Supply Chain</h1>
        <p className="subtitle">Sign in to manage inventory, procurement and stock movement.</p>
        {error && <div className="alert error">{error}</div>}
        <form className="allocation-form single" onSubmit={submit}>
          <label>Username<input required autoFocus autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
          <label>Password<input required type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          <button className="primary-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="demo-accounts">
          <strong>Synthetic demo accounts</strong> (password <code>Demo@123</code>)
          <ul>
            <li><code>admin.demo</code> — Administrator</li>
            <li><code>procurement.demo</code> — Procurement Officer</li>
            <li><code>warehouse.demo</code> — Warehouse Manager</li>
            <li><code>emergency.demo</code> — Department Staff (Emergency)</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

export default function Home() {
  const [data, setData] = useState(null);
  const [authState, setAuthState] = useState('checking'); // checking | out | in
  const [tab, setTab] = useState('dashboard');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [alloc, setAlloc] = useState({ productId: '101', departmentId: '1', quantity: '10', reason: 'Emergency ward requirement' });
  const [xfer, setXfer] = useState({ productId: '101', fromWarehouseId: '1', toWarehouseId: '2', quantity: '10' });
  const [emerg, setEmerg] = useState({ productId: '102', departmentId: '1', quantity: '20', reason: '' });
  const [supplierPick, setSupplierPick] = useState('');
  const [po, setPo] = useState({ supplierId: '', expectedDays: '7', notes: '', items: [{ productId: '', quantity: '50', unitPrice: '' }] });
  const [recv, setRecv] = useState({ orderId: '', warehouseId: '', lines: {} });

  const load = useCallback(async () => {
    try {
      const json = await api('/api/reports');
      setData(json); setAuthState('in'); setError('');
    } catch (e) {
      if (e.status === 401) { setAuthState('out'); setData(null); } else { setError(e.message); setAuthState((s) => (s === 'checking' ? 'in' : s)); }
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const me = data?.me;
  const can = (action) => me?.permissions?.includes(action);

  async function run(fn) {
    setBusy(true); setError(''); setNotice('');
    try { const json = await fn(); setNotice(`${json.message || 'Done.'}${json.auditSaved === false ? ' (SQL committed; MongoDB audit event could not be confirmed.)' : json.auditSaved ? ' MongoDB audit event saved.' : ''}`); await load(); return json; }
    catch (e) { if (e.status === 401) setAuthState('out'); setError(e.message); }
    finally { setBusy(false); }
  }
  async function logout() { await post('/api/auth/logout', {}); setData(null); setAuthState('out'); setNotice(''); }

  if (authState === 'checking') return <main className="shell"><p className="muted">Loading…</p></main>;
  if (authState === 'out') return <Login onLoggedIn={() => { setAuthState('checking'); load(); }} />;

  const products = data?.products || [];
  const warehouses = data?.warehouses || [];
  const summary = data?.summary || {};
  const own = me?.role === 'DEPARTMENT_STAFF';
  const deptOptions = own ? (data?.departments || []).filter((d) => d.department_id === me.departmentId) : (data?.departments || []);
  const orderIds = [...new Set((data?.openOrderItems || []).map((i) => i.order_id))];
  const recvItems = (data?.openOrderItems || []).filter((i) => String(i.order_id) === recv.orderId);
  const lineVal = (it, field) => recv.lines[it.order_item_id]?.[field] ?? (field === 'quantity' ? it.quantity_ordered - it.quantity_received : futureDate(365));
  const setLine = (it, field, value) => setRecv({ ...recv, lines: { ...recv.lines, [it.order_item_id]: { ...recv.lines[it.order_item_id], [field]: value } } });
  const sel = (rows, key, label, value, onChange, blank) => (
    <select required value={value} onChange={(e) => onChange(e.target.value)}>{blank && <option value="">{blank}</option>}{rows.map((r) => <option key={r[key]} value={r[key]}>{r[label]}</option>)}</select>
  );

  const tabs = [['dashboard', 'Dashboard'], ['allocate', 'Allocate stock'], ['procurement', 'Procurement'], ['transfers', 'Transfers'], ['emergency', 'Emergency requests'], ['alerts', 'Alerts & expiry']];

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">DBMS LAB PROJECT</p>
          <h1>Hospital Supply Chain</h1>
          <p className="subtitle">Inventory, procurement, batch expiry and traceable stock movement.</p>
        </div>
        <div className="user-box">
          <span><strong>{me?.fullName}</strong><br /><small>{ROLE_LABEL[me?.role]}</small></span>
          <button className="secondary-button" onClick={load} disabled={busy}>Refresh</button>
          <button className="secondary-button" onClick={logout}>Sign out</button>
        </div>
      </header>

      <nav className="tabs">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'tab active' : 'tab'} onClick={() => setTab(id)}>{label}</button>)}</nav>

      {error && <div className="alert error"><strong>Attention:</strong> {error}</div>}
      {notice && <div className="alert success">{notice}</div>}
      {data && <div className={`connection ${data.nosqlAvailable ? 'online' : 'offline'}`}><span className="status-dot" /> SQL connected · MongoDB {data.nosqlAvailable ? 'connected' : 'not available (audit trail unavailable)'}</div>}

      {tab === 'dashboard' && (<>
        <section className="metric-grid">
          <div className="metric"><span>Active products</span><strong>{number(summary.activeProducts)}</strong><small>Catalog items</small></div>
          <div className="metric warning-metric"><span>Low-stock records</span><strong>{number(summary.lowStockRecords)}</strong><small>At or below reorder level</small></div>
          <div className="metric warning-metric"><span>Near-expiry batches</span><strong>{number(summary.nearExpiryBatches)}</strong><small>Expiry within 60 days</small></div>
          <div className="metric"><span>Open purchase orders</span><strong>{number(summary.openOrders)}</strong><small>Pending or partial</small></div>
          <div className="metric warning-metric"><span>Open emergency requests</span><strong>{number(summary.openEmergency)}</strong><small>Awaiting procurement</small></div>
          <div className="metric"><span>Unresolved alerts</span><strong>{number(summary.openAlerts)}</strong><small>Low stock, expiry, shortage</small></div>
        </section>
        <div className="two-col">
          <DataTable title="Low stock" rows={data?.lowStock || []} columns={[{ key: 'product_name', label: 'Product' }, { key: 'warehouse_name', label: 'Location' }, { key: 'quantity', label: 'On hand' }, { key: 'reorder_level', label: 'Reorder at' }]} />
          <DataTable title="Near-expiry batches (60 days)" rows={data?.nearExpiry || []} columns={[{ key: 'product_name', label: 'Product' }, { key: 'batch_number', label: 'Batch' }, { key: 'quantity', label: 'Units' }, { key: 'expiry_date', label: 'Expiry', render: date }]} />
        </div>
        <div className="two-col">
          <DataTable title="Supplier performance" rows={data?.supplierPerformance || []} columns={[{ key: 'supplier_name', label: 'Supplier' }, { key: 'total_orders', label: 'Orders' }, { key: 'received_orders', label: 'Received' }, { key: 'on_time_pct', label: 'On-time %', render: (v) => v == null ? '—' : `${Number(v).toFixed(1)}%` }, { key: 'avg_days_to_receive', label: 'Avg days', render: (v) => v == null ? '—' : Number(v).toFixed(1) }]} />
          <DataTable title="Department issues this month" rows={data?.departmentIssues || []} columns={[{ key: 'department_name', label: 'Department' }, { key: 'issue_count', label: 'Issue records' }, { key: 'total_units_issued', label: 'Units issued' }]} />
        </div>
        <div className="two-col">
          <DataTable title="Inventory by product" rows={products} columns={[{ key: 'name', label: 'Product' }, { key: 'category', label: 'Category' }, { key: 'total_stock', label: 'Total stock', render: number }, { key: 'unit_cost', label: 'Unit cost', render: money }]} />
          <DataTable title="MongoDB event aggregation (30 days)" rows={data?.mongoEventCounts || []} columns={[{ key: 'event_type', label: 'Event type' }, { key: 'count', label: 'Event count', render: number }]} empty={data?.nosqlAvailable ? 'No events in the last 30 days.' : 'MongoDB is not connected.'} />
        </div>
        <DataTable title="Stock movement ledger (latest)" rows={data?.recentMovements || []} columns={[
          { key: 'movement_type', label: 'Type', render: (v) => <Badge value={v} /> }, { key: 'product_name', label: 'Product' }, { key: 'batch_number', label: 'Batch' }, { key: 'quantity', label: 'Qty' },
          { key: 'source_warehouse', label: 'From' }, { key: 'destination_warehouse', label: 'To warehouse' }, { key: 'department_name', label: 'To department' }, { key: 'performed_by', label: 'By' }, { key: 'created_at', label: 'When', render: stamp }]} />
        <DataTable title="Recent MongoDB audit events" rows={data?.recentEvents || []} columns={[{ key: 'event_type', label: 'Event' }, { key: 'product_id', label: 'Product ID' }, { key: 'quantity', label: 'Quantity' }, { key: 'actor', label: 'Actor' }, { key: 'role', label: 'Role' }, { key: 'timestamp', label: 'Timestamp', render: stamp }]} empty={data?.nosqlAvailable ? 'No audit events yet.' : 'MongoDB is not connected.'} />
      </>)}

      {tab === 'allocate' && (
        <section className="panel novelty-panel">
          <div><p className="eyebrow">EXPIRY-AWARE ALLOCATION (FEFO)</p><h2>Issue stock to a department</h2>
            <p>Eligible stock is taken from the earliest-expiring, non-expired batch first, across warehouses. Any unmet quantity is recorded as a shortage alert and an open emergency procurement request.</p></div>
          {!can('allocate') ? <Locked what="issue stock" /> : (
            <form className="allocation-form" onSubmit={(e) => { e.preventDefault(); run(() => post('/api/allocate', { productId: Number(alloc.productId), departmentId: Number(alloc.departmentId), quantity: Number(alloc.quantity), reason: alloc.reason })); }}>
              <label>Product{sel(products, 'product_id', 'name', alloc.productId, (v) => setAlloc({ ...alloc, productId: v }))}</label>
              <label>Requesting department{sel(deptOptions, 'department_id', 'name', own ? String(me.departmentId) : alloc.departmentId, (v) => setAlloc({ ...alloc, departmentId: v }))}</label>
              <label>Quantity<input required type="number" min="1" max="100000" value={alloc.quantity} onChange={(e) => setAlloc({ ...alloc, quantity: e.target.value })} /></label>
              <label>Reason<input required maxLength="250" value={alloc.reason} onChange={(e) => setAlloc({ ...alloc, reason: e.target.value })} /></label>
              <button className="primary-button" disabled={busy}>{busy ? 'Processing…' : 'Allocate stock'}</button>
            </form>)}
        </section>
      )}

      {tab === 'procurement' && (<>
        <div className="two-col">
          <section className="panel">
            <div className="panel-heading"><h2>Create purchase order</h2></div>
            {!can('createOrder') ? <Locked what="create purchase orders" /> : (
              <form className="allocation-form" onSubmit={(e) => { e.preventDefault(); run(() => post('/api/purchase-orders', { action: 'create', supplierId: Number(po.supplierId), expectedDays: Number(po.expectedDays), notes: po.notes, items: po.items.map((i) => ({ productId: Number(i.productId), quantity: Number(i.quantity), unitPrice: Number(i.unitPrice || products.find((p) => String(p.product_id) === i.productId)?.unit_cost || 0) })) })); }}>
                <label>Supplier{sel(data?.suppliers || [], 'supplier_id', 'name', po.supplierId, (v) => setPo({ ...po, supplierId: v }), 'Select supplier')}</label>
                <label>Expected in (days)<input required type="number" min="1" max="180" value={po.expectedDays} onChange={(e) => setPo({ ...po, expectedDays: e.target.value })} /></label>
                {po.items.map((it, idx) => (
                  <div className="line-row" key={idx}>
                    <label>Product{sel(products, 'product_id', 'name', it.productId, (v) => setPo({ ...po, items: po.items.map((x, j) => j === idx ? { ...x, productId: v, unitPrice: String(products.find((p) => String(p.product_id) === v)?.unit_cost ?? '') } : x) }), 'Select product')}</label>
                    <label>Qty<input required type="number" min="1" value={it.quantity} onChange={(e) => setPo({ ...po, items: po.items.map((x, j) => j === idx ? { ...x, quantity: e.target.value } : x) })} /></label>
                    <label>Unit price<input required type="number" min="0" step="0.01" value={it.unitPrice} onChange={(e) => setPo({ ...po, items: po.items.map((x, j) => j === idx ? { ...x, unitPrice: e.target.value } : x) })} /></label>
                    {po.items.length > 1 && <button type="button" className="link-button" onClick={() => setPo({ ...po, items: po.items.filter((_, j) => j !== idx) })}>Remove</button>}
                  </div>))}
                <button type="button" className="secondary-button full" onClick={() => setPo({ ...po, items: [...po.items, { productId: '', quantity: '50', unitPrice: '' }] })}>+ Add another product</button>
                <label className="full">Notes<input maxLength="250" value={po.notes} onChange={(e) => setPo({ ...po, notes: e.target.value })} /></label>
                <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Create purchase order'}</button>
              </form>)}
          </section>
          <section className="panel">
            <div className="panel-heading"><h2>Receive goods into a warehouse</h2></div>
            {!can('receiveOrder') ? <Locked what="receive goods" /> : !orderIds.length ? <p className="empty">No open purchase orders with outstanding items.</p> : (
              <form className="allocation-form" onSubmit={(e) => { e.preventDefault(); run(() => post('/api/purchase-orders', { action: 'receive', orderId: Number(recv.orderId), warehouseId: Number(recv.warehouseId), lines: recvItems.map((it) => ({ orderItemId: it.order_item_id, quantity: Number(lineVal(it, 'quantity')), expiryDate: lineVal(it, 'expiry') })) })); }}>
                <label>Purchase order<select required value={recv.orderId} onChange={(e) => setRecv({ ...recv, orderId: e.target.value, lines: {} })}><option value="">Select order</option>{orderIds.map((id) => <option key={id} value={id}>PO #{id}</option>)}</select></label>
                <label>Receiving warehouse{sel(warehouses, 'warehouse_id', 'name', recv.warehouseId, (v) => setRecv({ ...recv, warehouseId: v }), 'Select warehouse')}</label>
                {recvItems.map((it) => (
                  <div className="line-row" key={it.order_item_id}>
                    <label>{it.product_name} <small>(outstanding {it.quantity_ordered - it.quantity_received})</small><input type="number" min="0" max={it.quantity_ordered - it.quantity_received} value={lineVal(it, 'quantity')} onChange={(e) => setLine(it, 'quantity', e.target.value)} /></label>
                    <label>Batch expiry<input type="date" value={lineVal(it, 'expiry')} onChange={(e) => setLine(it, 'expiry', e.target.value)} /></label>
                  </div>))}
                <button className="primary-button" disabled={busy || !recv.orderId}>{busy ? 'Saving…' : 'Receive stock'}</button>
              </form>)}
          </section>
        </div>
        <DataTable title="Purchase orders" rows={data?.purchaseOrders || []} columns={[{ key: 'order_id', label: 'PO #' }, { key: 'supplier_name', label: 'Supplier' }, { key: 'status', label: 'Status', render: (v) => <Badge value={v} /> }, { key: 'order_date', label: 'Ordered', render: date }, { key: 'expected_date', label: 'Expected', render: date }, { key: 'received_date', label: 'Received', render: date }, { key: 'total_amount', label: 'Total', render: money }, { key: 'notes', label: 'Notes' }]} />
      </>)}

      {tab === 'transfers' && (<>
        <section className="panel novelty-panel">
          <div><p className="eyebrow">WAREHOUSE STOCK MOVEMENT</p><h2>Transfer between warehouses</h2>
            <p>Draws the source warehouse's earliest-expiring non-expired batches first and recreates them at the destination with the same expiry date. The whole transfer succeeds or is rolled back.</p></div>
          {!can('transfer') ? <Locked what="transfer stock" /> : (
            <form className="allocation-form" onSubmit={(e) => { e.preventDefault(); run(() => post('/api/transfers', { productId: Number(xfer.productId), fromWarehouseId: Number(xfer.fromWarehouseId), toWarehouseId: Number(xfer.toWarehouseId), quantity: Number(xfer.quantity) })); }}>
              <label>Product{sel(products, 'product_id', 'name', xfer.productId, (v) => setXfer({ ...xfer, productId: v }))}</label>
              <label>Quantity<input required type="number" min="1" value={xfer.quantity} onChange={(e) => setXfer({ ...xfer, quantity: e.target.value })} /></label>
              <label>From{sel(warehouses, 'warehouse_id', 'name', xfer.fromWarehouseId, (v) => setXfer({ ...xfer, fromWarehouseId: v }))}</label>
              <label>To{sel(warehouses, 'warehouse_id', 'name', xfer.toWarehouseId, (v) => setXfer({ ...xfer, toWarehouseId: v }))}</label>
              <button className="primary-button" disabled={busy}>{busy ? 'Processing…' : 'Transfer stock'}</button>
            </form>)}
        </section>
        <DataTable title="Stock movement ledger (latest)" rows={data?.recentMovements || []} columns={[{ key: 'movement_type', label: 'Type', render: (v) => <Badge value={v} /> }, { key: 'product_name', label: 'Product' }, { key: 'batch_number', label: 'Batch' }, { key: 'quantity', label: 'Qty' }, { key: 'source_warehouse', label: 'From' }, { key: 'destination_warehouse', label: 'To warehouse' }, { key: 'performed_by', label: 'By' }, { key: 'created_at', label: 'When', render: stamp }]} />
      </>)}

      {tab === 'emergency' && (<>
        <section className="panel novelty-panel">
          <div><p className="eyebrow">EMERGENCY PROCUREMENT</p><h2>Record and fulfil urgent requirements</h2>
            <p>Shortfalls from stock allocation appear here automatically. Staff can also raise a request directly; a procurement officer converts an open request into a purchase order.</p></div>
          {!can('requestEmergency') ? <Locked what="raise emergency requests" /> : (
            <form className="allocation-form" onSubmit={(e) => { e.preventDefault(); run(() => post('/api/emergency', { action: 'create', productId: Number(emerg.productId), departmentId: Number(emerg.departmentId), quantity: Number(emerg.quantity), reason: emerg.reason })); }}>
              <label>Product{sel(products, 'product_id', 'name', emerg.productId, (v) => setEmerg({ ...emerg, productId: v }))}</label>
              <label>Department{sel(deptOptions, 'department_id', 'name', own ? String(me.departmentId) : emerg.departmentId, (v) => setEmerg({ ...emerg, departmentId: v }))}</label>
              <label>Quantity needed<input required type="number" min="1" value={emerg.quantity} onChange={(e) => setEmerg({ ...emerg, quantity: e.target.value })} /></label>
              <label>Reason<input required maxLength="250" value={emerg.reason} onChange={(e) => setEmerg({ ...emerg, reason: e.target.value })} /></label>
              <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Raise emergency request'}</button>
            </form>)}
        </section>
        {can('fulfillEmergency') && <div className="alert info">Supplier for emergency orders: <select value={supplierPick || data?.suppliers?.[0]?.supplier_id || ''} onChange={(e) => setSupplierPick(e.target.value)}>{(data?.suppliers || []).map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>)}</select> · delivery expected in 2 days</div>}
        <DataTable title="Emergency requests" rows={data?.emergencyRequests || []} columns={[
          { key: 'request_id', label: '#' }, { key: 'product_name', label: 'Product' }, { key: 'department_name', label: 'Department' }, { key: 'quantity_needed', label: 'Qty' }, { key: 'status', label: 'Status', render: (v) => <Badge value={v} /> },
          { key: 'reason', label: 'Reason' }, { key: 'requested_by', label: 'Raised by' }, { key: 'order_id', label: 'PO #' }, { key: 'created_at', label: 'Raised', render: stamp },
          { key: 'action', label: '', render: (_, r) => r.status === 'OPEN' && can('fulfillEmergency') ? <button className="link-button" disabled={busy} onClick={() => run(() => post('/api/emergency', { action: 'order', requestId: r.request_id, supplierId: Number(supplierPick || data?.suppliers?.[0]?.supplier_id), expectedDays: 2 }))}>Create PO</button> : null }]} />
      </>)}

      {tab === 'alerts' && (<>
        <section className="panel">
          <div className="panel-heading"><h2>Expiry monitoring</h2></div>
          {!can('maintenance') ? <Locked what="run expiry tasks" /> : (
            <div className="button-row">
              <button className="secondary-button" disabled={busy} onClick={() => run(() => post('/api/maintenance', { action: 'expiry-scan' }))}>Run expiry scan</button>
              <button className="secondary-button" disabled={busy} onClick={() => run(() => post('/api/maintenance', { action: 'write-off' }))}>Write off expired batches</button>
              <span className="muted">Scan raises NEAR_EXPIRY alerts for batches expiring within 60 days. Write-off removes already-expired stock from inventory.</span>
            </div>)}
        </section>
        <DataTable title="Unresolved alerts" rows={data?.alerts || []} columns={[{ key: 'alert_type', label: 'Type', render: (v) => <Badge value={v} /> }, { key: 'product_name', label: 'Product' }, { key: 'warehouse_name', label: 'Location' }, { key: 'message', label: 'Message' }, { key: 'created_at', label: 'Raised', render: stamp }]} />
        <div className="two-col">
          <DataTable title="Low stock" rows={data?.lowStock || []} columns={[{ key: 'product_name', label: 'Product' }, { key: 'warehouse_name', label: 'Location' }, { key: 'quantity', label: 'On hand' }, { key: 'reorder_level', label: 'Reorder at' }]} />
          <DataTable title="Near-expiry batches (60 days)" rows={data?.nearExpiry || []} columns={[{ key: 'product_name', label: 'Product' }, { key: 'batch_number', label: 'Batch' }, { key: 'quantity', label: 'Units' }, { key: 'expiry_date', label: 'Expiry', render: date }, { key: 'days_to_expiry', label: 'Days left' }]} />
        </div>
      </>)}

      <footer><strong>Implementation note:</strong> academic demo using synthetic data. Access is controlled by signed-cookie sessions and a role/permission matrix enforced in every API route. Add HTTPS, password policies and monitoring before any real deployment.</footer>
    </main>
  );
}
