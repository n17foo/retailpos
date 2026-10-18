# ADR-003: Multi-Register Architecture — Repository Injection at Wiring Time

**Date**: 2025-01-01  
**Status**: Accepted — hosting assumption amended by ADR-018 (server mode is desktop-only)  
**Deciders**: Engineering Team

## Context

Multi-register POS deployments require client registers to be thin interfaces — all data reads and writes go to the server (hosted by the desktop app or a dedicated store-api host) over HTTP. The naive approach of adding `if (instoreApiConfig.isClient)` checks throughout service code was rejected because it pollutes business logic with infrastructure concerns and makes the code harder to test.

## Decision

`BasketServiceFactory.buildContainer()` calls `getOrderRepository()` and `getReturnRepository()`, which return either `OfflineOrderRepository` (SQLite) or `InstoreApiOrderRepository` (HTTP) based on `instoreApiConfig.isClient`. The factory injects the resolved repository into each service. Services never inspect the mode themselves.

`BasketServiceFactory.reset()` rebuilds the container when the operating mode changes (e.g. switching between server and client register).

## Consequences

Service code is clean and mode-agnostic. Mode switching is handled entirely at the factory level via `reset()`. The HTTP transport layer is handled by `InstoreApiServer` (route logic only) + `InstoreApiTransport` (socket binding) — since ADR-018 the socket lives in the Electron main process, and server mode is desktop-only.
