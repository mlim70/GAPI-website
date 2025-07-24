 // scripts/seed-membership-levels.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import MembershipLevel from '../src/models/membershipLevel.model.js';

const levels = [
  {
    key: 'lifetime',
    name: 'Lifetime',
    price: 100,
    currency: 'USD',
    isRecurring: false,
  },
  {
    key: 'annual',
    name: 'Annual',
    price: 50,
    currency: 'USD',
    interval: { unit: 'YEAR', count: 1 },
    isRecurring: true,
  },
  {
    key: 'student',
    name: 'Student',
    price: 0,
    currency: 'USD',
    isRecurring: false,
  },
  {
    key: 'associate',
    name: 'Associate',
    price: 25,
    currency: 'USD',
    interval: { unit: 'YEAR', count: 1 },
    isRecurring: true,
  },
  {
    key: 'associateLife',
    name: 'Associate Life',
    price: 100,
    currency: 'USD',
    isRecurring: false,
  },
  {
    key: 'test',
    name: 'Test',
    price: 0.01,
    currency: 'USD',
    interval: { unit: 'MINUTE', count: 3 },
    isRecurring: true,
  },
];

function assertLevels(arr: typeof levels) {
  arr.forEach(l => {
    if (l.price < 0) {
      throw new Error(`Bad data for level ${l.key}: price < 0`);
    }
    if (l.isRecurring) {
      if (!l.interval || l.interval.count <= 0 || !Number.isInteger(l.interval.count)) {
        throw new Error(`Bad interval for recurring level ${l.key}`);
      }
    }
  });
}

async function seed() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI missing');
    await mongoose.connect(uri);

    await MembershipLevel.init();
    assertLevels(levels);

    await MembershipLevel.bulkWrite(
      levels.map(l => ({
        updateOne: {
          filter: { key: l.key },
          update: { $set: l },
          upsert: true,
        },
      })),
    );

    const docs = await MembershipLevel.find({}, 'key price isRecurring').lean();
    console.table(docs.map(({ key, price, isRecurring }) => ({ key, price, isRecurring })));
    console.log('✅  Membership levels seeded/updated');
  } catch (err) {
    console.error('Seeding error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seed();
