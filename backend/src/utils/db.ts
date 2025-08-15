/**
 * Database connection utility with automatic index initialization
 * 
 * This module ensures that database indexes are created automatically
 * after the first successful connection, regardless of environment.
 * This is critical for Vercel serverless deployments where autoIndex: false
 * is set on all schemas to prevent race conditions during app boot.
 */
import mongoose from 'mongoose';
import { initIndexes } from '../db/initIndexes';

// Global connection cache for Vercel serverless
declare global {
  var _mongooseConn: Promise<typeof mongoose> | null;
}

let cachedConn: Promise<typeof mongoose> | null = global._mongooseConn || null;
let indexesInitialized = false;

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
    
    // Initialize indexes once after first successful connection
    if (!indexesInitialized && mongoose.connection.readyState === 1) {
      try {
        const environment = process.env.VERCEL ? 'Vercel serverless' : 'local server';
        console.log(`🔧 Initializing database indexes in ${environment} environment...`);
        await initIndexes();
        indexesInitialized = true;
        console.log('✅ Database indexes initialized successfully');
      } catch (error: any) {
        // Handle specific MongoDB error codes gracefully
        if (error.code === 85) { // IndexOptionsConflict
          console.log('ℹ️ Some indexes already exist with different options - this is normal');
          indexesInitialized = true; // Mark as initialized to avoid repeated attempts
        } else if (error.code === 48) { // NamespaceExists
          console.log('ℹ️ Some indexes already exist - this is normal');
          indexesInitialized = true; // Mark as initialized to avoid repeated attempts
        } else {
          console.warn('⚠️ Failed to initialize some indexes (this may happen in production):', error.message);
          // Don't fail the connection if index creation fails
          // In production, indexes might already exist
        }
      }
    }
    
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