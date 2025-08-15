# Token Management System

## Overview

The `TokenManager` class provides centralized JWT token management with automatic expiration handling and logout functionality.

## Features

- **Automatic Token Validation**: Checks token validity on every API request
- **Auto-Logout**: Automatically logs out users when tokens expire
- **Periodic Checks**: Validates tokens every minute in the background
- **Secure Storage**: Manages both token and user data in localStorage
- **Expiration Threshold**: Warns about tokens expiring within 5 minutes

## Usage

### Basic Usage

```typescript
import TokenManager from '../utils/tokenManager';

// Set token after login
TokenManager.setToken(token);
TokenManager.setUser(user);

// Get current token/user
const token = TokenManager.getToken();
const user = TokenManager.getUser();

// Logout
TokenManager.logout();
```

### API Integration

The `auth.ts` API client automatically:
- Includes valid tokens in Authorization headers
- Handles 401 responses with automatic logout
- Validates tokens before making authenticated requests

### Initialization

The TokenManager is initialized in `App.tsx` and runs background checks automatically.

## Token Validation

- Tokens are validated on every API request
- Invalid tokens trigger immediate logout
- Expired tokens are detected and handled gracefully
- Background checks run every 60 seconds

## Security Features

- Automatic cleanup of expired tokens
- Secure logout with localStorage cleanup
- Redirect to login page on authentication failures
- No token persistence beyond expiration 