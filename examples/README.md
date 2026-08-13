<!-- SPDX-License-Identifier: Apache-2.0 -->

# Comb Examples

Minimal issuer and consumer integrations belong here. Examples should illustrate protocol behavior without depending on the hosted Fellowship service.

## Product-neutral laboratory

The runnable `lab/` example starts an Issuer and a Consumer on separate
loopback origins. It exercises discovery, creator delegation, Authorization
Code with PKCE, signed entitlement issuance, Consumer verification, signing-key
rotation, and Grant lapse without Fellowship or product-private APIs.

From the repository root:

```bash
pnpm lab
```
