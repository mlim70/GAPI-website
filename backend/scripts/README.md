# Membership Level Seeder

This script seeds or updates membership levels in your MongoDB 'gapi-website' database ('membershiplevels' collection).

## Usage

1. **Set up your environment:**
   - Ensure you have a `.env` file in backend/ with `MONGODB_URI`.

2. **Run script**
   - From the project root, run:
     'npm install'
     'npm run build'
     *'npx tsx backend/scripts/seed-membership-levels.ts'*

*What it does:*
   - Upserts all defined membership levels.
   - Prints a table of the seeded/updated levels.

## Customizing Membership Levels
- Edit the `levels` array in `seed-membership-levels.ts` to add, remove, or modify plans.
- Each level must have a unique `key`.

## Notes
- The script will not delete levels that are not listed in the `levels` array, but will update existing ones with matching keys.
- For one-time (non-recurring) plans, `isRecurring` should be set to `false`.

---

**Example:**

```
  {
    key: 'test',
    name: 'Test',
    price: 0.01,
    currency: 'USD',
    interval: { unit: 'MINUTE', count: 3 }, //Count: how many units make up a single billing cycle 
    //(can omit 'interval' if (isRecurring: 'false'))
    isRecurring: true,
  },
``` 