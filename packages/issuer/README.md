<!-- SPDX-License-Identifier: Apache-2.0 -->

# Comb Issuer SDK

Issuer-side helpers belong here: discovery documents, creator delegation, authorization-request handling, scoped claim construction, and signing-key rotation. The SDK consumes an application's grant decisions; it does not decide billing state.

The current slice generates non-exportable RSA private signing keys, publishes public JWKS documents, and issues ten-minute-or-shorter Comb entitlement tokens.
