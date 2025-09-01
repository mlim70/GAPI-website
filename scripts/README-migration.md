# Legacy Member Migration Script

This script migrates legacy members from your old system to the new Stripe-based system.

## ⚠️ Safety Features

The script now includes comprehensive dry-run capabilities to preview what will happen before making any changes.

## Usage

### Dry Run (Recommended First Step)

```bash
# Basic dry run
npm run ts-node scripts/importLegacyMembers.ts --dry-run

# Dry run with detailed output
npm run ts-node scripts/importLegacyMembers.ts --dry-run --details

# Dry run with report saved to file
npm run ts-node scripts/importLegacyMembers.ts --dry-run --output=migration-report.json
```

### Live Migration

```bash
# Run the actual migration (after reviewing dry run results)
npm run ts-node scripts/importLegacyMembers.ts
```

## Command Line Options

- `--dry-run` or `-d`: Run in preview mode (no database/Stripe changes)
- `--details` or `-v`: Show detailed information for each record
- `--output=filename.json`: Save the dry-run report to a JSON file

## What the Dry Run Shows

### Summary Statistics
- Total records processed
- Valid vs skipped records
- Number of users to create/update
- Number of subscriptions to create (by type)

### Validation Results
- Which membership levels are found/missing
- Data integrity issues
- Email format problems

### Detailed Analysis
- What action will be taken for each user
- Trial end dates for recurring subscriptions
- Grace period applications
- Warnings and potential conflicts

## Migration Types

### Lifetime Members
- Converted to internal ONE_TIME subscriptions
- No Stripe trial needed
- Permanent access

### Recurring Members
- **Active subscriptions**: Stripe trial ending on their legacy end date (+30 days grace if near expiry)
- **Expired subscriptions**: Marked as EXPIRED in internal system
- **Long-term subscriptions**: Fallback to internal system (if trial > 2 years)

## Safety Checklist

Before running live migration:

1. ✅ Run dry-run and review results
2. ✅ Verify all membership levels exist in database
3. ✅ Check for data integrity issues
4. ✅ Review trial end dates for recurring members
5. ✅ Ensure you have a backup of your database
6. ✅ Have a rollback plan ready

## Example Dry Run Output

```
🚀 Starting migration (DRY RUN)
📊 Details: ON

🔍 Running dry-run validation...

📋 DRY RUN SUMMARY:
==================================================
Total records: 5
Valid records: 4
Skipped records: 1
Errors: 0

📈 MIGRATION PLAN:
Users to create: 3
Users to update: 1
Subscriptions to create: 4
  - Stripe trials: 2
  - Internal fallbacks: 0
  - Lifetime: 2
  - Expired: 0

✅ VALIDATION RESULTS:
==================================================
Membership levels found: LIFETIME, ANNUAL, ASSOCIATE
Membership levels missing: None
Data integrity issues: 0

📝 DETAILED RESULTS:
==================================================

✅ VALID RECORDS:

kmmatthew8@gmail.com:
  Level: LIFETIME (lifetime)
  User action: CREATE_USER
  Subscription action: CREATE_LIFETIME

sparkyjindo@gmail.com:
  Level: ANNUAL (recurring)
  User action: CREATE_USER
  Subscription action: CREATE_STRIPE_TRIAL
  Trial ends: 2028-10-01T00:00:00.000Z
  Grace period: Applied

🔍 DRY RUN COMPLETED - No changes were made to the database or Stripe
To run the actual migration, remove the --dry-run flag
```

## Troubleshooting

### Missing Membership Levels
If the dry run shows missing membership levels, ensure all your membership levels are created in the database with `status: 'ACTIVE'`.

### Data Integrity Issues
Review and fix any data integrity issues before running the live migration:
- Recurring subscriptions should have endDate
- Lifetime subscriptions should have endDate: null
- startDate should be before endDate

### Large Datasets
For large datasets, consider:
- Running the script during off-peak hours
- Monitoring Stripe API rate limits
- Breaking the migration into smaller batches

