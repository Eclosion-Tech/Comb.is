<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Comb Protocol v0 — Laboratory Draft

**Status:** Experimental · Phase F0 only · Not a production interoperability promise  
**Canonical home:** `comb.is`  
**First complete product implementation:** Fellowship (`fellowship.so`)<br>
**Specification license:** [CC BY 4.0](LICENSES/CC-BY-4.0.txt)  
**Last updated:** 2026-07-17

---

## 1. Purpose

Comb lets a service verify a narrow fact:

> An authenticated supporter currently holds a creator-authorized Grant containing Benefit B.

The Grant may have originated from a recurring subscription, a one-time purchase, a complimentary membership, an import, or another payment rail. Comb begins after an Issuer has decided that the Grant is valid. It standardizes how that entitlement is requested, disclosed, signed, trusted, and verified across services and independent instances.

Comb's job is portable authorization, not payment settlement.

## 2. Non-goals

Comb v0 does not define:

- payment processing, custody, routing, currency, tax, refunds, or chargebacks;
- wallets, blockchains, or money transmission;
- a global supporter identifier or supporter home-server protocol;
- automatic trust of arbitrary public instances;
- a public issuer registry or reputation system;
- cross-creator bundles;
- content hosting, fulfillment, messaging, or analytics;
- JWE-encrypted claims or DPoP-bound tokens in the core v0 profile;
- instantaneous offline-token revocation.

**Federate the entitlements. Never federate the money.**

## 3. Design principles

1. **Use existing security machinery.** HTTPS, OAuth 2.0, OpenID Connect, JWT access tokens, and JWKS; no novel cryptography.
2. **Trust is creator-scoped.** A signature proves which Issuer spoke. A separate policy decision establishes which Creator that Issuer may represent.
3. **Disclose the minimum.** A Consumer receives only the Creator and Benefits it requested and the supporter authorized.
4. **Expiry is honest.** Offline claims have bounded staleness, not magical revocation.
5. **Money is upstream.** Payment source never changes token verification semantics.
6. **Migration must be possible.** Creator identity should survive a move between Issuers.
7. **The laboratory proves the protocol.** Production billing does not depend on F0.

## 4. Roles

| Role | Responsibility |
|---|---|
| **Supporter** | Authenticates with an Issuer and authorizes disclosure of an entitlement. |
| **Creator** | Defines Tiers and Benefits and delegates one or more Issuers to speak for it. |
| **Issuer** | Maintains Grants, authenticates Supporters, and signs Comb claims. Fellowship is one implementation; products such as Worm or Studious may implement their own Issuers without depending on Fellowship. |
| **Consumer** | A service that requests and verifies a claim to grant access. In OAuth/OIDC terms it is a Client and Resource Server. |
| **Operator** | Runs an Issuer. An Operator is not automatically trusted for every Creator. |

## 5. Identifiers

### 5.1 Issuer

An Issuer identifier is an absolute HTTPS URL with no query or fragment. It follows OIDC exact-match semantics. Consumers MUST compare the configured Issuer to the JWT `iss` value exactly; they MUST NOT normalize lookalike URLs or accept subdomains implicitly.

Example:

```text
https://members.example
```

Loopback HTTP is permitted only in the F0 local laboratory.

### 5.2 Creator

A Creator identifier is an absolute HTTPS URL resolving to a Comb Creator document. A creator-controlled domain is the portable form:

```text
https://artist.example/.well-known/comb-creator
```

An Issuer MAY provide an issuer-scoped identifier for a Creator without a domain:

```text
https://members.example/creators/crtr_01J.../comb.json
```

Issuer-scoped Creator identifiers work for v1 but are not independently portable. Migration requires either retaining that URL or adopting a creator-controlled identifier and updating Consumer trust.

### 5.3 Supporter subject

`sub` is opaque, never reassigned, and local to an Issuer. Pairwise subjects per Consumer are the v0 default to prevent unrelated Consumers from correlating a Supporter automatically.

Email is not a subject identifier. A Consumer needing email requests the appropriate OIDC scope and receives it through the ID token or UserInfo response with explicit consent; Comb entitlement tokens do not include it.

### 5.4 Consumer and audience

A Consumer has an OAuth `client_id`, registered redirect URIs, and an HTTPS resource/audience identifier. The entitlement token's `aud` MUST identify the Consumer resource for which it was minted.

### 5.5 Grant, Tier, and Benefit

- Grant IDs are opaque and unique within an Issuer.
- Tier identifiers are optional in a claim and MUST NOT be used when a Benefit check is sufficient.
- Benefit identifiers are case-sensitive strings controlled by the Creator. HTTPS URLs are recommended for federated use because they provide a collision-resistant namespace.

Example:

```text
https://artist.example/benefits/supporter-shelf
https://sculpturegarden.example/benefits/monthly-sticker
```

## 6. Creator delegation

A valid signature from Issuer I does not prove that I may speak for Creator C. The Consumer needs both local trust policy and creator delegation.

A Comb Creator document has the following v0 shape:

```json
{
  "comb_version": "0.1",
  "creator": "https://artist.example/.well-known/comb-creator",
  "display_name": "Example Artist",
  "issuers": [
    {
      "issuer": "https://members.example",
      "creator_ref": "crtr_01JABC...",
      "not_before": "2026-07-17T00:00:00Z",
      "not_after": null
    }
  ]
}
```

Consumer administrators explicitly approve a `(creator, issuer)` tuple. Automated verification then confirms that:

1. the JWT is signed by the approved Issuer;
2. the claim names the approved Creator identifier;
3. the Creator document contains a delegation covering the token's `iat`, under the Consumer's current cached policy; and
4. the local Consumer policy permits the requested Benefit.

An Issuer MUST NOT become trusted merely by publishing a Creator document on its own domain. For an issuer-scoped Creator identifier, administrator approval is the root of trust. For a creator-controlled identifier, the external delegation makes migration and independent verification possible but does not silently modify local allowlists.

During migration, a Creator document MAY delegate old and new Issuers for an explicit overlap window. Consumers SHOULD surface overlapping authority to administrators. The Creator SHOULD set `not_after` on the old delegation and retain the record through the maximum token lifetime and cache window. Abrupt document removal cannot guarantee immediate invalidation because Consumers may be offline or cached; emergency response relies on the Consumer's local Issuer-disable control.

## 7. Issuer discovery

An Issuer publishes:

```text
GET /.well-known/comb
Content-Type: application/json
```

Example:

```json
{
  "comb_version": "0.1",
  "issuer": "https://members.example",
  "authorization_endpoint": "https://members.example/oauth/authorize",
  "token_endpoint": "https://members.example/oauth/token",
  "jwks_uri": "https://members.example/.well-known/jwks.json",
  "openid_configuration": "https://members.example/.well-known/openid-configuration",
  "claim_signing_alg_values_supported": ["RS256"],
  "scopes_supported": ["openid", "comb:entitlements"]
}
```

Requirements:

- `issuer` MUST exactly match the eventual token `iss`.
- All production endpoints MUST use HTTPS.
- Consumers MUST configure allowed Issuers administratively before fetching metadata; arbitrary user-supplied discovery is forbidden.
- Discovery clients MUST defend against SSRF, private-network redirects, redirect loops, oversized responses, and invalid content types.
- Standard OIDC discovery remains authoritative for OIDC behavior. Comb metadata only advertises the entitlement extension.

## 8. Authorization flow

Comb v0 uses OIDC Authorization Code Flow with PKCE.

1. The Consumer selects one of its configured Issuers.
2. The Consumer creates `state`, `nonce`, and a PKCE verifier/challenge.
3. The Consumer redirects the Supporter to the Issuer's authorization endpoint.
4. The request includes:
   - `scope=openid comb:entitlements`;
   - the Consumer resource/audience;
   - the requested Creator identifier; and
   - the usual OIDC client, redirect, state, nonce, and PKCE parameters.
5. The Issuer authenticates the Supporter and shows which Creator and Benefits will be disclosed.
6. The Consumer exchanges the authorization code at the token endpoint.
7. The Issuer returns an ID token for authentication and a separate Comb JWT access token for entitlement authorization.

The exact encoding of resource/audience and requested Creator will be fixed during F0. The preferred direction is OAuth Resource Indicators for the audience plus a small Comb authorization-detail object rather than dynamically invented scopes.

There is no unconstrained `POST /claims` endpoint that accepts an arbitrary Supporter and audience. Claims arise only from an authenticated, authorized flow or a narrowly scoped server-side grant explicitly defined by a later profile.

## 9. Entitlement token

### 9.1 Header

```json
{
  "alg": "RS256",
  "kid": "key-2026-07",
  "typ": "at+jwt"
}
```

- `alg` MUST be on the Consumer's configured allowlist. `none` is forbidden.
- `kid` MUST identify a key in the Issuer's JWKS.
- Consumers MUST ignore and reject untrusted key-location headers such as token-supplied `jku` or `x5u`.

### 9.2 Claims

```json
{
  "iss": "https://members.example",
  "sub": "pairwise-supporter-id",
  "aud": "https://worm.example",
  "client_id": "worm-web",
  "iat": 1784246400,
  "exp": 1784247000,
  "jti": "tok_01JABC...",
  "comb": {
    "version": "0.1",
    "grants": [
      {
        "id": "grnt_01JABC...",
        "creator": "https://artist.example/.well-known/comb-creator",
        "benefits": [
          "https://artist.example/benefits/supporter-shelf"
        ],
        "valid_until": "2026-08-17T00:00:00Z"
      }
    ]
  }
}
```

Rules:

- Maximum v0 token lifetime is 10 minutes.
- `jti` is unique per token and MAY be used for replay detection in high-risk Consumers.
- The token contains only active Grants relevant to the requested Creator and Consumer.
- `valid_until` communicates the known Grant horizon but never extends the JWT beyond `exp`.
- Price, payment method, address, email, lifetime spend, and unrelated creator relationships MUST NOT appear.
- Absence of a required Benefit means access is denied. Consumers MUST NOT infer access from a friendly Tier name.

## 10. Consumer verification

A conforming Consumer performs these checks in order:

1. Resolve the expected Issuer from local configuration, not solely from the untrusted token.
2. Obtain and cache the Issuer's discovery document and JWKS under bounded rules.
3. Select the configured algorithm and `kid`; verify the signature.
4. Require `typ=at+jwt` and reject `alg=none` or an unexpected algorithm.
5. Compare `iss`, `aud`, and `client_id` exactly to configured values.
6. Validate `iat` and `exp` with a small documented clock-skew allowance.
7. Validate the `comb.version` understood by the Consumer.
8. For every Grant used, validate the local `(creator, issuer)` allowlist and a delegation covering the token's `iat`.
9. Require the exact Benefit identifier needed for the operation.
10. Map the pairwise `sub` to a local account and establish a local session no longer than the Consumer's revalidation policy permits.

Consumers MUST NOT log raw tokens, place them in URLs, expose them to browser analytics, or store them in insecure browser storage.

## 11. Expiry, lapse, and revocation

Comb v0 entitlement tokens are short-lived bearer credentials. They are **not instantly revocable**.

The core v0 profile uses signed JWS bearer tokens. JWE encryption and DPoP proof-of-possession may be explored as optional profiles after F0; Consumers MUST NOT require either for baseline v0 interoperability.

- When a Grant lapses or is revoked, the Issuer stops including it in newly issued tokens.
- An already issued token may remain usable until `exp`.
- Consumers requiring faster reaction MAY accept signed lifecycle webhooks and terminate local sessions early.
- Consumers requiring strict online status MAY use a future introspection profile; introspection is outside F0.
- Consumer session duration and cache behavior MUST NOT quietly turn a 10-minute token into days of unchecked access.

This is bounded staleness, not revocation. Documentation and UI must use those words honestly.

## 12. Signing-key rotation

- Every signing key has a unique `kid`.
- Before issuing with a new key, the Issuer publishes its public JWK.
- Old public keys remain published for at least the maximum token lifetime, clock skew, and documented cache overlap after the last token signed by that key.
- Private keys are stored outside ordinary application rows where practical and are never returned by an API.
- A routine F0 rotation MUST succeed without restarting Consumers or sharing secrets.
- Key compromise response may shorten trust administratively, but offline tokens cannot be cryptographically recalled. Consumers need an emergency issuer-disable control.

## 13. Lifecycle webhooks — provisional extension

Webhooks accelerate local session invalidation and cache refresh; they do not replace token validation or reconciliation.

Each endpoint has a separate secret. Deliveries include an event ID, event type, occurrence time, Issuer, Creator, Consumer-specific supporter subject, opaque Grant ID, and effective time. Bodies are signed with HMAC-SHA256 over the exact raw payload plus a timestamp.

Consumers:

- verify signature and timestamp using constant-time comparison;
- deduplicate event IDs;
- tolerate retries and out-of-order delivery;
- respond quickly before asynchronous processing;
- treat events as prompts to refresh state, not as permission to invent a Grant; and
- expose a reconciliation path for missed events.

The event registry and retry schedule remain open for v0.2.

## 14. Relationship to x402 and other payment protocols

[x402](https://docs.x402.org/core-concepts/http-402) defines an HTTP-native payment challenge and settlement flow: a server returns `402 Payment Required`, a client authorizes payment, and the server verifies or settles it before returning a resource. Its common flow is stateless and does not require an account or session.

Comb defines a different layer:

| | x402 | Comb |
|---|---|---|
| Primary fact | This request carries an acceptable payment | This authenticated supporter holds a current Grant |
| Typical duration | One request or purchase | Ongoing membership or time-bounded entitlement |
| Identity | Wallet/payer sufficient for the payment flow | OIDC-authenticated, pairwise Supporter subject |
| State | Intentionally stateless at protocol core | Durable Grant at the Issuer; short-lived derived claim |
| Money | Describes verification and settlement | Deliberately payment-rail agnostic |
| Best fit | API calls, agents, micropayments, one-shot content | Cross-service membership, recurring support, physical and digital benefits |

Possible future composition:

1. an x402 payment settles and an Issuer creates a one-time or time-bounded Grant;
2. Comb distributes that resulting entitlement to authorized Consumers; or
3. a Consumer accepts a Comb Benefit from members and offers x402 as a nonmember pay-per-use fallback.

The x402 payment proof MUST NOT be treated as a Comb entitlement without an Issuer creating a Grant, and Comb MUST NOT require a wallet. Wallet and on-chain support remain outside Comb v0.

## 15. Phase F0 laboratory

F0 uses two product-neutral Comb participants with separate state, keys, base URLs, and configuration. The Issuer and Consumer may be small laboratory implementations; neither depends on Fellowship or any other product-private API.

### Required demonstration

1. Start Issuer A and Consumer B from documented commands.
2. Create Creator C and a Creator document delegating authority to A.
3. Register B as a Consumer at A.
4. Configure B to trust exactly `(C, A)`.
5. Create Supporter S and active Grant G on A.
6. From the Consumer, complete OIDC authorization against A and receive a Comb token.
7. Verify that Benefit X unlocks the Consumer.
8. Verify that A cannot claim an unapproved Creator and that an untrusted instance cannot claim C.
9. Rotate A's signing key and prove old unexpired plus new tokens verify correctly.
10. Lapse G. Prove the existing token works only until `exp` and a new authorization no longer contains X.
11. Repeat the setup from clean state using only public documentation.

### Exit criterion

The complete demonstration passes without a shared database, shared signing secret, hard-coded development bypass, or manual token copying.

## 16. Security baseline

Before production federation, implementations need:

- a documented threat model;
- mature OIDC/OAuth libraries and current security profiles;
- PKCE, `state`, and `nonce` validation;
- strict redirect-URI registration;
- rate limiting and abuse controls;
- encrypted secrets and address data;
- signing-key rotation and emergency Issuer disablement;
- SSRF-safe discovery and webhook delivery;
- webhook destination verification, signing, retry, and audit history;
- least-privilege admin roles;
- data retention and deletion policy; and
- tests for issuer confusion, audience confusion, algorithm substitution, replay, stale delegation, and key rollover.

F0 may use local shortcuts only when they are explicit, isolated, and impossible to enable in a production build accidentally.

## 17. Open questions for v0.2

1. Exact authorization-detail encoding for requested Creator and Benefits.
2. Creator document discovery and delegation migration semantics.
3. Whether pairwise subjects impede legitimate supporter account linking across Consumers.
4. Optional online introspection for high-value or immediate-revocation use cases.
5. Standard webhook event types and reconciliation endpoint.
6. Issuer selection UX when a supporter has accounts on multiple instances.
7. Proof and consent model for cross-creator bundles.
8. Conformance suites and the minimum supported OIDC profile.
9. How partial implementations advertise whether they support Issuer, Consumer, or both roles.

## 18. Versioning

- Protocol values use `major.minor`, beginning with `0.1`.
- Any breaking claim, discovery, trust, or authorization change increments the major version.
- Consumers reject unsupported major versions.
- Experimental fields use a clearly namespaced extension object and cannot change the meaning of core fields.
- The specification is written from the F0 implementation. Behavior that has not been demonstrated remains a proposal, not protocol law.
