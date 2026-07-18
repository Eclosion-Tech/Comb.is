// SPDX-License-Identifier: Apache-2.0

import {
  verifyEntitlementToken,
  type VerifyEntitlementTokenOptions
} from "@comb-is/consumer";
import type { CombSigningKey } from "@comb-is/issuer";
import { beforeAll, describe, expect, it } from "vitest";
import {
  TEST_AUDIENCE,
  TEST_BENEFIT,
  TEST_CLIENT_ID,
  TEST_CREATOR,
  TEST_ISSUER,
  TEST_NOW,
  createTestJwks,
  createTestSigningKey,
  issueTestToken
} from "./fixtures/test-issuer.js";

let signingKey: CombSigningKey;

beforeAll(async () => {
  signingKey = await createTestSigningKey();
});

function verificationOptions(
  overrides: Partial<VerifyEntitlementTokenOptions> = {}
): VerifyEntitlementTokenOptions {
  return {
    expectedIssuer: TEST_ISSUER,
    expectedAudience: TEST_AUDIENCE,
    expectedClientId: TEST_CLIENT_ID,
    requiredCreator: TEST_CREATOR,
    requiredBenefit: TEST_BENEFIT,
    trustedDelegations: [
      {
        issuer: TEST_ISSUER,
        creator: TEST_CREATOR,
        notBefore: "2026-01-01T00:00:00.000Z",
        notAfter: null
      }
    ],
    jwks: createTestJwks([signingKey]),
    now: TEST_NOW,
    ...overrides
  };
}

describe("Comb v0 entitlement verification", () => {
  it("keeps generated private signing keys non-exportable", () => {
    expect(signingKey.privateKey.extractable).toBe(false);
    expect(signingKey.publicJwk.d).toBeUndefined();
  });

  it("accepts a valid, trusted, audience-bound entitlement", async () => {
    const token = await issueTestToken(signingKey);
    const verified = await verifyEntitlementToken(
      token,
      verificationOptions()
    );

    expect(verified.subject).toBe("pairwise-supporter-1");
    expect(verified.grant.id).toBe("grant-test-1");
    expect(verified.grant.benefits).toContain(TEST_BENEFIT);
  });

  it("rejects an expired token", async () => {
    const token = await issueTestToken(signingKey, {
      now: new Date("2026-07-17T15:00:00.000Z"),
      lifetimeSeconds: 60
    });

    await expect(
      verifyEntitlementToken(token, verificationOptions())
    ).rejects.toThrow();
  });

  it("rejects the wrong audience", async () => {
    const token = await issueTestToken(signingKey);

    await expect(
      verifyEntitlementToken(
        token,
        verificationOptions({
          expectedAudience: "https://studious.example"
        })
      )
    ).rejects.toThrow();
  });

  it("rejects the wrong client_id", async () => {
    const token = await issueTestToken(signingKey);

    await expect(
      verifyEntitlementToken(
        token,
        verificationOptions({ expectedClientId: "other-client" })
      )
    ).rejects.toThrow("client_id");
  });

  it("rejects an untrusted creator and Issuer binding", async () => {
    const token = await issueTestToken(signingKey);

    await expect(
      verifyEntitlementToken(
        token,
        verificationOptions({
          trustedDelegations: [
            {
              issuer: "https://issuer-b.example",
              creator: TEST_CREATOR
            }
          ]
        })
      )
    ).rejects.toThrow("not trusted");
  });

  it("rejects a missing Benefit", async () => {
    const token = await issueTestToken(signingKey);

    await expect(
      verifyEntitlementToken(
        token,
        verificationOptions({
          requiredBenefit: "https://artist.example/benefits/sticker"
        })
      )
    ).rejects.toThrow("absent");
  });

  it("supports bounded signing-key rotation", async () => {
    const oldToken = await issueTestToken(signingKey);
    const nextKey = await createTestSigningKey("key-2026-08");
    const nextToken = await issueTestToken(nextKey, {
      jwtId: "tok-test-2"
    });
    const overlapJwks = createTestJwks([signingKey, nextKey]);

    await expect(
      verifyEntitlementToken(
        oldToken,
        verificationOptions({ jwks: overlapJwks })
      )
    ).resolves.toBeDefined();
    await expect(
      verifyEntitlementToken(
        nextToken,
        verificationOptions({ jwks: overlapJwks })
      )
    ).resolves.toBeDefined();
    await expect(
      verifyEntitlementToken(
        oldToken,
        verificationOptions({ jwks: createTestJwks([nextKey]) })
      )
    ).rejects.toThrow();
  });

  it("refuses to issue tokens longer than ten minutes", async () => {
    await expect(
      issueTestToken(signingKey, { lifetimeSeconds: 601 })
    ).rejects.toThrow("between 1 and 600");
  });
});
