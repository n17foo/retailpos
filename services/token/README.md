# Token Management System

This module provides a centralized way to manage platform-specific tokens and JWTs across all services in the RetailPOS application.

## Features

- Secure token storage using MMKV (native) or AsyncStorage (web)
- Automatic token refresh via platform-specific providers
- Token expiration management
- Platform-specific token providers for all supported e-commerce platforms
- Simple utility functions for common token operations

## Usage Example

Here's how you can use the token management system in your services:

```typescript
import { getPlatformToken, hasValidPlatformToken } from '../token/tokenUtils';
import { TokenType } from '../token/tokenServiceInterface';
import { ECommercePlatform } from '../../utils/platforms';

// In your service's API call method:
async function makeApiCall() {
  // Get the token, it will be refreshed automatically if expired
  const token = await getPlatformToken(ECommercePlatform.MAGENTO);

  if (!token) {
    throw new Error('Could not obtain valid token for API call');
  }

  // Use the token in your API call
  const response = await fetch('https://api.example.com/endpoint', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // Process response...
}

// Check if a valid token exists
async function canMakeApiCall() {
  return await hasValidPlatformToken(ECommercePlatform.SHOPIFY);
}
```

## Architecture

The token management system consists of:

1. **TokenServiceInterface** - Defines the contract for token operations
2. **TokenService** - Implements secure token storage and retrieval
3. **TokenServiceFactory** - Manages token service instances and platform providers
4. **TokenUtils** - Provides simple utility functions for common token operations

## Integration with Other Services

This token management system is designed to be used by all services that need to make authenticated API calls to e-commerce platforms, including:

- Category Service
- Payment Service
- Inventory Service
- Order Service
- Product Service
- Refund Service
- Search Service
- Sync Service

Each service should use the token utils to retrieve tokens instead of managing their own token storage or authentication logic.
