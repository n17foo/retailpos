# ADR-014: Spec-First Development with EARS Format

**Date**: 2025-01-01  
**Status**: Accepted  
**Deciders**: Engineering Team

## Context

Complex features (checkout, sync, multi-register) needed clear requirements before implementation to avoid costly rework. Ad-hoc feature development was producing ambiguous scope and undocumented edge cases.

## Decision

All features are documented using EARS (Easy Approach to Requirements Syntax) format in `docs/features/<feature>/` (README + rules.md; the former `docs/specs/` tree was retired into these). Each spec covers: Context, Ubiquitous Requirements, Event-Driven Requirements, State-Driven Requirements, Optional Features, Edge Cases, and Component Traceability. Specs are written from the actual code, not aspirationally — they describe what the system does, not what it might do.

## Consequences

Specs serve as living documentation that new developers can read before diving into code. The traceability table in each spec maps every requirement to a source file. Gaps between older feature documents and current specs are explicitly noted rather than silently ignored. The EARS format enforces a consistent structure that makes requirements reviewable and testable.
