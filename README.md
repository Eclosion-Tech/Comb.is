<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Comb

Comb is an open protocol for portable patronage entitlements. It lets a service verify that an authenticated supporter holds a creator-authorized benefit without putting Comb in the payment path.

> Federate the entitlements. Never federate the money.

Comb is experimental. The current document is a laboratory draft, not a production interoperability promise.

## Run the laboratory

Requirements: Node.js 22 or newer and pnpm 10.

    pnpm install
    pnpm typecheck
    pnpm test

The current executable slice publishes JSON Schemas for discovery, creator delegation, and entitlement claims; issues RS256 laboratory tokens; verifies their signature, audience, client, lifetime, creator delegation, and required Benefit; and exercises expiry and signing-key rotation through the conformance suite.

## Repository map

- [`COMB_PROTOCOL.md`](COMB_PROTOCOL.md) — protocol draft and F0 acceptance criteria
- `packages/core/` — shared schemas, identifiers, and validation primitives
- `packages/issuer/` — issuer-side discovery, authorization, and signing helpers
- `packages/consumer/` — consumer-side discovery, trust, and verification helpers
- `conformance/` — implementation-independent fixtures and conformance tests
- `examples/` — minimal issuer and consumer integrations
- `apps/reference-fellowship/` — generic self-hostable reference server and distribution surface

The public repository contains everything needed to implement, test, and self-host Comb. The hosted Fellowship service, its branding, infrastructure, and internal integrations live in the private `fellowship.so` repository and must not be required for useful self-hosting.

## Licensing

Comb uses a path-based license split:

| Material | License |
|---|---|
| Protocol specification and documentation | [CC BY 4.0](LICENSES/CC-BY-4.0.txt) |
| Schemas, SDKs, conformance tools, and examples | [Apache-2.0](LICENSES/Apache-2.0.txt) |
| Self-hostable reference server | [AGPL-3.0-or-later](LICENSES/AGPL-3.0-or-later.txt) |

See [`LICENSE.md`](LICENSE.md) for the exact path mapping. Individual files may carry SPDX identifiers where useful.
