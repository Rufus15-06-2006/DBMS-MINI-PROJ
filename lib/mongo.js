import { MongoClient } from 'mongodb';

const globalForMongo = globalThis;

export async function getMongoDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set. Copy .env.example to .env and configure MongoDB.');

  let client = globalForMongo.__hospitalMongoClient;
  if (!client) {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
    globalForMongo.__hospitalMongoClient = client;
  }
  if (!globalForMongo.__hospitalMongoConnected) {
    await client.connect();
    globalForMongo.__hospitalMongoConnected = true;
  }
  return client.db(process.env.MONGODB_DATABASE || 'hospital_supply_chain_events');
}
