#!/usr/bin/env tsx

import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { createNewsletterToken, verifyNewsletterToken } from '../utils/newsletterTokens';
import { mgSubscribe, mgUnsubscribe } from '../services/newsletterMailgun';

console.log('🔍 GAPI Newsletter Debug Script');
console.log('================================\n');

// 1. Environment Variables Check
console.log('📋 Environment Variables:');
console.log('------------------------');
const envVars = {
  'NODE_ENV': process.env.NODE_ENV || 'development (default)',
  'VITE_API_URL': process.env.VITE_API_URL || 'NOT SET',
  'CLIENT_URL': process.env.CLIENT_URL || 'NOT SET',
  'NEWSLETTER_JWT_SECRET': process.env.NEWSLETTER_JWT_SECRET ? 
    `${process.env.NEWSLETTER_JWT_SECRET.substring(0, 8)}...` : 'NOT SET',
  'MAILING_LIST_ADDRESS': process.env.MAILING_LIST_ADDRESS || 'NOT SET',
  'MAILGUN_API_KEY': process.env.MAILGUN_API_KEY ? 
    `${process.env.MAILGUN_API_KEY.substring(0, 8)}...` : 'NOT SET',
  'MAILGUN_DOMAIN': process.env.MAILGUN_DOMAIN || 'NOT SET',
};

Object.entries(envVars).forEach(([key, value]) => {
  const status = value === 'NOT SET' ? '❌' : '✅';
  console.log(`${status} ${key}: ${value}`);
});

console.log('');

// 2. JWT Secret Validation
console.log('🔐 JWT Secret Validation:');
console.log('-------------------------');
try {
  if (!process.env.NEWSLETTER_JWT_SECRET) {
    console.log('❌ NEWSLETTER_JWT_SECRET is not set');
  } else {
    console.log('✅ NEWSLETTER_JWT_SECRET is set');
    console.log(`   Length: ${process.env.NEWSLETTER_JWT_SECRET.length} characters`);
    console.log(`   First 8 chars: ${process.env.NEWSLETTER_JWT_SECRET.substring(0, 8)}...`);
  }
} catch (error) {
  console.log('❌ Error checking JWT secret:', error);
}

console.log('');

// 3. Test Token Creation and Verification
console.log('🎫 Token Creation & Verification Test:');
console.log('-------------------------------------');
try {
  const testEmail = 'test@example.com';
  console.log(`📧 Test email: ${testEmail}`);
  
  // Create token
  const token = createNewsletterToken(testEmail, 30);
  console.log('✅ Token created successfully');
  console.log(`   Token: ${token.substring(0, 50)}...`);
  
  // Verify token
  const verifiedEmail = verifyNewsletterToken(token);
  console.log('✅ Token verified successfully');
  console.log(`   Verified email: ${verifiedEmail}`);
  
  // Check if emails match
  if (verifiedEmail === testEmail.toLowerCase()) {
    console.log('✅ Email verification matches');
  } else {
    console.log('❌ Email verification mismatch');
    console.log(`   Expected: ${testEmail.toLowerCase()}`);
    console.log(`   Got: ${verifiedEmail}`);
  }
  
} catch (error: any) {
  console.log('❌ Token test failed:', error.message);
  console.log('   Stack:', error.stack);
}

console.log('');

// 4. Test with Your Actual Email
console.log('📧 Test with Your Email:');
console.log('------------------------');
const yourEmail = 'kmmatthew8@gmail.com';
try {
  console.log(`📧 Your email: ${yourEmail}`);
  
  // Create token
  const token = createNewsletterToken(yourEmail, 30);
  console.log('✅ Token created successfully');
  console.log(`   Token: ${token.substring(0, 50)}...`);
  
  // Verify token
  const verifiedEmail = verifyNewsletterToken(token);
  console.log('✅ Token verified successfully');
  console.log(`   Verified email: ${verifiedEmail}`);
  
  // Check if emails match
  if (verifiedEmail === yourEmail.toLowerCase()) {
    console.log('✅ Email verification matches');
  } else {
    console.log('❌ Email verification mismatch');
  }
  
} catch (error: any) {
  console.log('❌ Your email test failed:', error.message);
}

console.log('');

// 5. URL Construction Test
console.log('🔗 URL Construction Test:');
console.log('-------------------------');
try {
  const testToken = 'test-token-123';
  const confirmUrl = `${process.env.VITE_API_URL}/api/newsletter/confirm?token=${testToken}`;
  console.log('✅ Confirm URL constructed:');
  console.log(`   ${confirmUrl}`);
  
  // Check if URL is valid
  try {
    new URL(confirmUrl);
    console.log('✅ URL is valid');
  } catch (urlError) {
    console.log('❌ URL is invalid:', urlError);
  }
  
} catch (error: any) {
  console.log('❌ URL construction failed:', error.message);
}

console.log('');

// 6. Mailgun Service Check
console.log('📧 Mailgun Service Check:');
console.log('------------------------');
try {
  // Check if we can create the service
  console.log('✅ Mailgun service imports successfully');
  
  // Check if environment variables are set for Mailgun
  if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
    console.log('✅ Mailgun environment variables are set');
  } else {
    console.log('❌ Mailgun environment variables are missing');
  }
  
} catch (error: any) {
  console.log('❌ Mailgun service check failed:', error.message);
}

console.log('');

// 7. Summary
console.log('📊 Summary:');
console.log('-----------');
const issues = [];

if (!process.env.NEWSLETTER_JWT_SECRET) {
  issues.push('NEWSLETTER_JWT_SECRET is not set');
}
if (!process.env.VITE_API_URL) {
  issues.push('VITE_API_URL is not set');
}
if (!process.env.CLIENT_URL) {
  issues.push('CLIENT_URL is not set');
}
if (!process.env.MAILING_LIST_ADDRESS) {
  issues.push('MAILING_LIST_ADDRESS is not set');
}
if (!process.env.MAILGUN_API_KEY) {
  issues.push('MAILGUN_API_KEY is not set');
}
if (!process.env.MAILGUN_DOMAIN) {
  issues.push('MAILGUN_DOMAIN is not set');
}

if (issues.length === 0) {
  console.log('✅ All required environment variables are set');
} else {
  console.log('❌ Issues found:');
  issues.forEach(issue => console.log(`   - ${issue}`));
}

console.log('');
console.log('🔍 Debug script completed');
console.log('================================');
