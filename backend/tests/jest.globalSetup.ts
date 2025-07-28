import 'dotenv/config';
import mongoose from 'mongoose';

export default async () => {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/gapi-test';
  console.log(`🔌 Connecting to MongoDB: ${uri.replace(/\/\/.*@/, '//***@')}`);
  await mongoose.connect(uri, {
    dbName: 'gapi-test',
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 1,
    connectTimeoutMS: 10_000
  });
  mongoose.set('bufferCommands', false);  // fail fast
  console.log('✅ MongoDB connected (globalSetup)');
}; 