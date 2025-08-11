import mongoose from 'mongoose';

let cachedConn: mongoose.Mongoose | null = null;
let cachedPromise: Promise<mongoose.Mongoose> | null = null;

export async function connectToDatabase() {
  if (cachedConn) return cachedConn;
  if (!cachedPromise) {
    cachedPromise = mongoose
      .connect(process.env.MONGODB_URI!)
      .then(m => {
        cachedConn = m;
        return m;
      });
  }
  cachedConn = await cachedPromise;
  return cachedConn;
}

export async function connectDB(uri: string) {
  return mongoose.connect(uri);
}

export async function disconnectDB() {
  if (cachedConn) {
    await mongoose.disconnect();
    cachedConn = null;
    cachedPromise = null;
  }
} 