import { getMongoDatabase } from './mongo.js';

// Writes one audit document to MongoDB. Returns false (never throws) so a MongoDB outage cannot
// undo or hide an SQL transaction that has already committed.
export async function logEvent(eventType, fields = {}) {
  try {
    const db = await getMongoDatabase();
    await db.collection('audit_events').insertOne({ event_type: eventType, ...fields, timestamp: new Date() });
    return true;
  } catch (error) {
    console.error('MongoDB audit write failed:', error.message);
    return false;
  }
}
