// Load environment variables the same way as the main application
import 'dotenv/config';

// Log environment variable status (without exposing sensitive data)
if (process.env.MONGODB_URI) {
  const maskedUri = process.env.MONGODB_URI.replace(/\/\/.*@/, '//***@');
  console.log(`🔌 MONGODB_URI: ${maskedUri}`);
} else {
  console.log('❌ MONGODB_URI not set');
  console.log('💡 Make sure your .env file contains: MONGODB_URI=your_connection_string');
} 