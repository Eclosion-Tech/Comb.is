<!-- SPDX-License-Identifier: Apache-2.0 -->

# Comb Core

Shared, runtime-agnostic Comb schemas and validation primitives belong here: wire types, identifier parsing, claim shapes, and fixtures. This package must not own billing, storage, or application policy.

The v0.1 laboratory schemas are published in `schemas/`; `parseEntitlementClaims` provides the corresponding strict runtime claim validation.
