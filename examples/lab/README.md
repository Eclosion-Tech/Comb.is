# Comb product-neutral laboratory

This laboratory runs two independent loopback origins:

- Issuer A publishes Comb and OIDC discovery, a Creator document, JWKS, and one
  seeded Grant.
- Consumer B performs Authorization Code with PKCE, validates the OIDC nonce,
  fetches Creator delegation, verifies the Comb token, and opens a local
  session.

Neither participant uses Fellowship code, a shared database, or a shared
signing secret.

## Run it

From the Comb repository root:

    pnpm install
    pnpm lab

Open http://127.0.0.1:4102 and select Run the handshake.

The default controls are intentionally loopback-only and laboratory-only:

    curl -X POST http://127.0.0.1:4101/lab/rotate
    curl -X POST http://127.0.0.1:4101/lab/lapse
    curl -X POST http://127.0.0.1:4101/lab/restore

Override the ports with COMB_LAB_ISSUER_PORT and COMB_LAB_CONSUMER_PORT.

## Security boundary

The automatic supporter approval and unauthenticated laboratory controls are
explicit F0 shortcuts. They are isolated to this example and MUST NOT be copied
into a production Issuer. Production implementations need real authentication,
consent, registered clients, abuse controls, durable code storage, and the full
security baseline in COMB_PROTOCOL.md.
