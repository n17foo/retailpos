# ADR-006: Money Arithmetic — Integer-Cent Math

**Date**: 2025-01-01  
**Status**: Accepted  
**Deciders**: Engineering Team

## Context

IEEE 754 floating-point arithmetic produces errors in monetary calculations (e.g. `0.1 + 0.2 !== 0.3` in JavaScript). These errors compound across line items and tax calculations, producing incorrect totals that are unacceptable in a financial context.

## Decision

All monetary operations go through `shared/utils/money.ts`, which converts values to integer cents internally before performing arithmetic and converts back to decimal for display. The module exposes: `multiplyMoney`, `addMoney`, `subtractMoney`, `sumMoney`, `calculateTax`, `calculateLineTotal`, `roundMoney`, and `formatMoney`. Raw float arithmetic on money values is prohibited throughout the codebase.

## Consequences

Totals are correct across all calculations regardless of the number of line items or tax rate. All monetary code must import from `shared/utils/money.ts` — this constraint is enforced by convention and documented in `AGENT.md`. There is no runtime enforcement, so code review is the primary guard against violations.
