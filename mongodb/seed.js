import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const databaseName = process.env.MONGODB_DATABASE || 'hospital_supply_chain_events';
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });

try {
  await client.connect();
  const db = client.db(databaseName);
  const events = db.collection('audit_events');
  await events.createIndex({ timestamp: -1 });
  await events.createIndex({ event_type: 1, timestamp: -1 });
  await events.createIndex({ product_id: 1, timestamp: -1 });

  const now = Date.now();
  const demoEvents = [
    {
      event_type: 'STOCK_ISSUED', product_id: 101, department_id: 1, requested_quantity: 15,
      quantity: 15, shortfall: 0, actor: 'warehouse.demo', reason: 'Emergency ward routine issue',
      timestamp: new Date(now - 1 * 60 * 60 * 1000),
      metadata: { demo_seed: true, allocation_policy: 'FEFO' }
    },
    {
      event_type: 'BATCH_EXPIRY_REVIEW', product_id: 102, department_id: null, quantity: 18,
      actor: 'procurement.demo', reason: 'Review batch expiry inside 60 days',
      timestamp: new Date(now - 4 * 60 * 60 * 1000),
      metadata: { demo_seed: true, days_to_expiry: 22, action: 'Review issue priority' }
    },
    {
      event_type: 'PURCHASE_ORDER_PENDING', product_id: 105, department_id: null, quantity: 30,
      actor: 'procurement.demo', reason: 'Critical medicine replenishment is pending',
      timestamp: new Date(now - 8 * 60 * 60 * 1000),
      metadata: { demo_seed: true, order_id: 5003, supplier_id: 3 }
    }
  ];

  // Add demo documents only if the collection does not already contain seeded examples.
  const existingSeed = await events.countDocuments({ 'metadata.demo_seed': true });
  if (existingSeed === 0) {
    await events.insertMany(demoEvents);
    console.log(`Inserted ${demoEvents.length} demo audit documents into ${databaseName}.audit_events`);
  } else {
    console.log('Demo seed events already exist; left them unchanged.');
  }
  console.log('MongoDB indexes are ready.');
} catch (error) {
  console.error('MongoDB seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
