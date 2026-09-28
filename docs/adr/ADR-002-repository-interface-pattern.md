# ADR-002: Repository Interface Pattern — No I-Prefix

**Date**: 2025-01-01  
**Status**: Accepted  
**Deciders**: Engineering Team

## Context

The project needed to support two data backends — SQLite for offline/server mode and HTTP for client registers — for the same repository operations, without scattering `if (isClient)` checks through service code. Java-style `IOrderRepository` naming was considered but rejected as unnecessary noise in a TypeScript codebase where interfaces are a first-class concept.

## Decision

The interface takes the plain name (e.g. `OrderRepository`). Implementations are named by their transport:

- `OfflineOrderRepository` — SQLite-backed implementation
- `InstoreApiOrderRepository` — HTTP-backed implementation for client registers

Each repository file exports the interface, the offline singleton, and a `getOrderRepository()` factory function that checks `instoreApiConfig.isClient` and returns the appropriate implementation. No `I`-prefix on interfaces.

## Consequences

Services (`CheckoutService`, `RefundService`) are completely unaware of the current operating mode. The mode decision is made once at wiring time inside `BasketServiceFactory`. Adding a new backend means adding a new implementation class without touching any service code. The naming convention is consistent across all repository domains.
