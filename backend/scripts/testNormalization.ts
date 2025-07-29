// backend/scripts/testNormalization.ts
import { normalizeEmail } from '../src/utils/emailUtils';
import { normalizeUsername } from '../src/utils/usernameUtils';

function testNormalization() {
  console.log('=== TESTING NORMALIZATION FUNCTIONS ===\n');

  // Test email normalization
  console.log('Email Normalization Tests:');
  const testEmails = [
    'test@gmail.com',
    'TEST@gmail.com',
    'test+tag@gmail.com',
    'test.tag@gmail.com',
    'test+tag.tag@gmail.com',
    'user@example.com',
    'USER@EXAMPLE.COM',
    'user+test@example.com'
  ];

  testEmails.forEach(email => {
    const normalized1 = normalizeEmail(email);
    const normalized2 = normalizeEmail(normalized1); // Test idempotency
    console.log(`"${email}" -> "${normalized1}" -> "${normalized2}" (idempotent: ${normalized1 === normalized2})`);
  });

  console.log('\nUsername Normalization Tests:');
  const testUsernames = [
    'testuser',
    'TestUser',
    'test-user',
    'test_user',
    'TEST_USER',
    'Test-User',
    'test.user',
    'test user'
  ];

  testUsernames.forEach(username => {
    const normalized1 = normalizeUsername(username);
    const normalized2 = normalizeUsername(normalized1); // Test idempotency
    console.log(`"${username}" -> "${normalized1}" -> "${normalized2}" (idempotent: ${normalized1 === normalized2})`);
  });

  // Test specific cases that might cause issues
  console.log('\nEdge Cases:');
  console.log('Empty string:', `"" -> "${normalizeEmail('')}"`);
  console.log('Null/undefined:', `null -> "${normalizeEmail(null as any)}"`);
  console.log('Whitespace only:', `"   " -> "${normalizeEmail('   ')}"`);

  console.log('\nUsername edge cases:');
  console.log('Empty string:', `"" -> "${normalizeUsername('')}"`);
  console.log('Null/undefined:', `null -> "${normalizeUsername(null as any)}"`);
  console.log('Whitespace only:', `"   " -> "${normalizeUsername('   ')}"`);

  // Test potential conflicts
  console.log('\nPotential Conflict Tests:');
  const conflictTests: Array<
    | { email1: string; email2: string; shouldConflict: boolean }
    | { username1: string; username2: string; shouldConflict: boolean }
  > = [
    { email1: 'test@gmail.com', email2: 'test+tag@gmail.com', shouldConflict: true },
    { email1: 'test@gmail.com', email2: 'test.tag@gmail.com', shouldConflict: true },
    { email1: 'test@gmail.com', email2: 'TEST@gmail.com', shouldConflict: true },
    { email1: 'test@gmail.com', email2: 'test@example.com', shouldConflict: false },
    { username1: 'testuser', username2: 'TestUser', shouldConflict: true },
    { username1: 'test-user', username2: 'test_user', shouldConflict: false },
    { username1: 'testuser', username2: 'testuser', shouldConflict: true }
  ];

  conflictTests.forEach(test => {
    if ('email1' in test) {
      const norm1 = normalizeEmail(test.email1);
      const norm2 = normalizeEmail(test.email2);
      const conflicts = norm1 === norm2;
      console.log(`Email conflict: "${test.email1}" vs "${test.email2}" -> ${conflicts} (expected: ${test.shouldConflict})`);
    } else if ('username1' in test) {
      const norm1 = normalizeUsername(test.username1);
      const norm2 = normalizeUsername(test.username2);
      const conflicts = norm1 === norm2;
      console.log(`Username conflict: "${test.username1}" vs "${test.username2}" -> ${conflicts} (expected: ${test.shouldConflict})`);
    }
  });
}

// Run the test
testNormalization(); 