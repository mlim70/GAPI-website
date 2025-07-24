# Membership Level Seeder

This script seeds or updates membership levels in your MongoDB 'gapi-website' database ('membershiplevels' collection).

## Usage

1. **Set up your environment:**
   - Ensure you have a `.env` file in the project root with a valid `MONGODB_URI`.

2. **Install dependencies:**
   - From the project root, run:
     'npm install'

3. **Run the script:**
   - From the project root, execute:
     'npx node --loader ts-node/esm backend/scripts/seed-membership-levels.ts'

4. **What it does:**
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
    interval: { unit: 'MINUTE', count: 3 }, //can omit this line if (isRecurring: 'false')
    isRecurring: true,
  },
``` 