# ADR-015: PED Integration via Instore API

**Date**: 2026-05-02  
**Status**: Accepted  
**Deciders**: Engineering Team

## Context

PIN Entry Devices (PEDs) are specialized payment terminals that handle chip-and-PIN, contactless, and signature-based card transactions. Unlike integrated payment SDKs, PEDs communicate via proprietary protocols (serial, USB, Ethernet) and require vendor-specific drivers. Direct PED integration in the POS client would introduce several challenges:

1. **Platform fragmentation**: Different PED vendors (Ingenico, Verifone, PAX) use different communication protocols and SDKs
2. **PCI compliance burden**: Handling raw card data in the client increases PCI DSS scope and audit requirements
3. **Hardware coupling**: POS client would need to manage USB/serial connections, driver installation, and device lifecycle
4. **Multi-terminal complexity**: Each POS terminal would need its own PED configuration and connection management
5. **Testing difficulty**: Unit and integration tests would require physical PED hardware or complex mocking

The existing payment architecture uses `PaymentServiceFactory` to abstract provider-specific implementations. Adding PED as a direct provider would violate the separation of concerns between UI logic and hardware communication.

## Decision

**PED integration must be implemented through the Instore API**, not as a direct payment provider in the POS client. The architecture follows this flow:

```
POS Client → InstoreApiTransport → Instore API → PED Hardware
```

### Implementation Details

1. **Instore API exposes PED endpoints**:
   - `POST /api/ped/initiate` — Start payment session, returns session ID
   - `GET /api/ped/status/:sessionId` — Poll payment status (waiting, processing, approved, declined)
   - `POST /api/ped/cancel/:sessionId` — Cancel in-progress payment
   - `GET /api/ped/devices` — List available PED devices

2. **POS client uses existing `InstoreApiTransport`**:
   - No new payment provider needed
   - Payment flow remains consistent with other providers
   - `PaymentTerminalScreen` polls `/api/ped/status` for updates
   - UI shows "Present card to terminal" during `waiting` status

3. **Instore API handles PED communication**:
   - Vendor-specific drivers installed on Instore API server
   - Manages device connections, retries, and error handling
   - Stores transaction logs and audit trail
   - Returns sanitized payment response (no raw card data)

4. **Configuration**:
   - PED device mapping stored in Instore API database
   - Each POS terminal ID maps to a physical PED device ID
   - POS client sends `registerId` with payment request
   - Instore API routes to correct PED based on register mapping

### Example Flow

```typescript
// POS Client (PaymentTerminalScreen.tsx)
const response = await instoreApi.post('/api/ped/initiate', {
  amount: 2599,
  registerId: 'REG-001',
  orderId: 'ORD-12345',
});

const sessionId = response.sessionId;

// Poll for status
const pollStatus = setInterval(async () => {
  const status = await instoreApi.get(`/api/ped/status/${sessionId}`);

  if (status.state === 'approved') {
    clearInterval(pollStatus);
    onPaymentComplete(status.transaction);
  } else if (status.state === 'declined' || status.state === 'error') {
    clearInterval(pollStatus);
    setError(status.errorMessage);
  }
}, 1000);
```

## Consequences

### Positive

- **Separation of concerns**: POS client remains focused on UI/UX, Instore API handles hardware protocols
- **Centralized management**: Single point of control for PED configuration, firmware updates, and monitoring
- **Vendor agnostic**: New PED vendors can be added to Instore API without modifying POS client
- **PCI compliance**: Sensitive card data never touches POS client, reducing compliance scope
- **Testability**: POS client tests don't require physical PED hardware
- **Multi-terminal support**: One Instore API instance can manage PEDs for multiple POS terminals
- **Consistent UX**: Payment flow matches existing provider pattern (connecting → waiting → approved/declined)
- **Offline resilience**: Instore API can queue failed transactions for retry when network recovers

### Negative

- **Network dependency**: PED payments require Instore API to be reachable (mitigated by local network deployment)
- **Latency**: Additional network hop adds ~50-100ms compared to direct USB connection (acceptable for payment flows)
- **Instore API complexity**: Instore API must handle PED driver installation and device management

### Neutral

- **No changes to existing payment architecture**: `PaymentServiceFactory` and provider pattern remain unchanged
- **Reuses existing infrastructure**: `InstoreApiTransport` already handles API communication, retries, and error handling
- **Consistent with platform strategy**: Aligns with existing decision to centralize hardware integration in Instore API (see ADR-005: Platform Abstraction Factory)

## Alternatives Considered

### Alternative 1: Direct PED Provider

Create `PedPaymentService` implementing `PaymentServiceInterface`, with native modules for USB/serial communication.

**Rejected because**:

- Requires native module development for each platform (iOS, Android, Electron)
- Increases PCI compliance scope by handling card data in client
- Difficult to test without physical hardware
- Vendor-specific SDKs would bloat client bundle size

### Alternative 2: Electron-Only PED Integration

Implement PED support only in Electron via `ElectronPaymentService`, using Node.js serial/USB libraries.

**Rejected because**:

- Excludes mobile/tablet deployments that may need PED support
- Still couples POS client to hardware protocols
- Doesn't solve multi-terminal management problem

### Alternative 3: Hybrid Approach

Allow both direct PED (for Electron) and API-based PED (for mobile).

**Rejected because**:

- Increases complexity with two code paths for same functionality
- Inconsistent behavior across platforms
- Doubles testing and maintenance burden

## Related Decisions

- **ADR-005: Platform Abstraction Factory** — Established pattern of abstracting hardware via platform services
- **ADR-008: Authentication Pluggable Multi-Method** — Similar registry pattern for extensibility
- **ADR-013: Scanner Hardware Abstraction** — Precedent for hardware integration via platform layer

## References

- Payment behaviour: docs/features/payments/ (EARS spec retired)
- Instore API transport: `features/multi-register/services/InstoreApiTransport.ts`
- Payment service factory: `features/payments/services/PaymentServiceFactory.ts`
- PCI DSS requirements: https://www.pcisecuritystandards.org/
