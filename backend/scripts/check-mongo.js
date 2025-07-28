#!/usr/bin/env node

const mongoose = require('mongoose');

async function checkMongoConnection() {
  console.log('🔍 Checking MongoDB connection...\n');
  
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gapi-test';
  console.log(`URI: ${uri.replace(/\/\/.*@/, '//***@')}`);
  
  try {
    console.log('Attempting to connect...');
    await mongoose.connect(uri, {
      dbName: 'gapi-test',
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log('✅ MongoDB connection successful!');
    console.log(`Database: ${mongoose.connection.db.databaseName}`);
    console.log(`Host: ${mongoose.connection.host}`);
    console.log(`Port: ${mongoose.connection.port}`);
    
    await mongoose.connection.close();
    console.log('✅ Connection closed successfully');
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('\n💡 Solutions:');
    console.log('1. Start MongoDB locally:');
    console.log('   - Windows: Start MongoDB service');
    console.log('   - Or run: mongod');
    console.log('2. Use cloud MongoDB (Atlas):');
    console.log('   - Set MONGODB_URI environment variable');
    console.log('   - Example: MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/gapi-test');
    console.log('3. Use Docker:');
    console.log('   - docker run -d -p 27017:27017 --name mongodb mongo:latest');
  }
}

checkMongoConnection().catch(console.error); 