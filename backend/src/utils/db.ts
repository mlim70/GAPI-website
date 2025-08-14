import mongoose from 'mongoose';

// Global connection cache for Vercel serverless
declare global {
  var _mongooseConn: Promise<typeof mongoose> | null;
}

let cachedConn: Promise<typeof mongoose> | null = global._mongooseConn || null;

export async function connectToDatabase() {
  // If we already have a cached connection, return it
  if (cachedConn) {
    try {
      // Check if the connection is still alive
      if (mongoose.connection.readyState === 1) {
        return mongoose;
      }
      // Connection is dead, clear cache
      cachedConn = null;
      global._mongooseConn = null;
    } catch (error) {
      // Clear cache on error
      cachedConn = null;
      global._mongooseConn = null;
    }
  }

  // Create new connection
  if (!cachedConn) {
    cachedConn = mongoose.connect(process.env.MONGODB_URI!, {
      // Optimize for Vercel serverless
      maxPoolSize: 1, // Single connection for serverless
      minPoolSize: 0, // No minimum connections
      maxIdleTimeMS: 30000, // Close connections after 30s of inactivity
      serverSelectionTimeoutMS: 5000, // Faster server selection
      socketTimeoutMS: 10000, // Socket timeout
      bufferCommands: false, // Disable mongoose buffering
    });
    
    // Cache the connection globally
    global._mongooseConn = cachedConn;
  }

  try {
    await cachedConn;
    return mongoose;
  } catch (error) {
    // Clear cache on error
    cachedConn = null;
    global._mongooseConn = null;
    throw error;
  }
}

export async function connectDB(uri: string) {
  return mongoose.connect(uri);
}

export async function disconnectDB() {
  if (cachedConn) {
    await mongoose.disconnect();
    cachedConn = null;
    global._mongooseConn = null;
  }
}

// Add connection event handlers for better debugging
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
}); 