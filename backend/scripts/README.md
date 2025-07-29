# Backend Scripts

### fixMembershipLevels.ts

**Purpose**: Manually synchronizes membership levels between Stripe and your MongoDB database.

**When to use**:
- After making changes to Stripe products/prices
- When membership levels are out of sync
- During development/testing
- Emergency database repairs

**What it does**:
- Fetches all active prices from Stripe
- Updates membership level records in MongoDB

**Command to run**:
from backend/:
*npm run fix-memberships*

**Note**: This script is for manual use only. Regular synchronization happens automatically via Stripe webhooks when products/prices are updated in the Stripe dashboard. 