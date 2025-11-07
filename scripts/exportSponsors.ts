#!/usr/bin/env tsx
// scripts/exportSponsors.ts
/**
 * Export sponsors collection from MongoDB to CSV file
 * 
 * Usage:
 *   npm run export:sponsors [output-file.csv]
 *   
 * If no output file is specified, defaults to: sponsors-export-YYYY-MM-DD.csv
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from backend
const envPath = path.resolve(__dirname, '../backend/.env');
dotenv.config({ path: envPath });

// Import Sponsor model
const SponsorSchema = new mongoose.Schema({
  name: String,
  email: String,
  company: String,
  phone: String,
  message: String,
  tierName: String,
  amount: Number,
  stripeCustomerId: String,
  stripeSessionId: String,
  stripePaymentIntentId: String,
  status: String,
  createdAt: Date,
  updatedAt: Date
}, { collection: 'sponsors' });

const Sponsor = mongoose.model('Sponsor', SponsorSchema);

// Helper function to escape CSV fields
function escapeCsvField(field: string | undefined | null): string {
  if (!field) return '';
  
  const str = String(field);
  
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

async function main() {
  try {
    // Get output filename from command line args or use default
    const args = process.argv.slice(2);
    const outputFile = args[0] || `sponsors-export-${new Date().toISOString().split('T')[0]}.csv`;
    const outputPath = path.resolve(process.cwd(), outputFile);

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Fetch all sponsors
    console.log('📊 Fetching sponsors...');
    const sponsors = await Sponsor.find({}).sort({ createdAt: -1 }).lean();
    
    if (sponsors.length === 0) {
      console.log('⚠️  No sponsors found in database');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`📝 Found ${sponsors.length} sponsors`);

    // Define CSV headers
    const headers = [
      'ID',
      'Name',
      'Email',
      'Company',
      'Phone',
      'Message',
      'Tier Name',
      'Amount (USD)',
      'Status',
      'Stripe Customer ID',
      'Stripe Session ID',
      'Stripe Payment Intent ID',
      'Created At',
      'Updated At'
    ];

    // Build CSV rows
    const rows = sponsors.map(sponsor => [
      sponsor._id.toString(),
      escapeCsvField(sponsor.name),
      escapeCsvField(sponsor.email),
      escapeCsvField(sponsor.company),
      escapeCsvField(sponsor.phone),
      escapeCsvField(sponsor.message),
      escapeCsvField(sponsor.tierName),
      sponsor.amount ? (sponsor.amount / 100).toFixed(2) : '0.00',
      sponsor.status || '',
      escapeCsvField(sponsor.stripeCustomerId),
      escapeCsvField(sponsor.stripeSessionId),
      escapeCsvField(sponsor.stripePaymentIntentId),
      sponsor.createdAt ? new Date(sponsor.createdAt).toISOString() : '',
      sponsor.updatedAt ? new Date(sponsor.updatedAt).toISOString() : ''
    ]);

    // Combine headers and rows
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Write to file
    fs.writeFileSync(outputPath, csv, 'utf-8');
    
    console.log(`✅ Successfully exported ${sponsors.length} sponsors to: ${outputPath}`);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error exporting sponsors:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();

