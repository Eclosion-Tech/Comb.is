<!-- SPDX-License-Identifier: Apache-2.0 -->

# Comb Consumer SDK

Consumer-side helpers belong here: allowlisted discovery, creator/issuer trust policy, JWKS caching, entitlement-token verification, and benefit checks. Secure defaults must fail closed.

The current verifier accepts only RS256 `at+jwt` tokens and requires exact Issuer, audience, client, creator-delegation, and Benefit matches.
