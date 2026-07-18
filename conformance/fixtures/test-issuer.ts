// SPDX-License-Identifier: Apache-2.0

import {
  createCombJwks,
  generateCombSigningKey,
  issueEntitlementToken,
  type CombSigningKey,
  type IssueEntitlementTokenInput
} from "@comb-is/issuer";

export const TEST_NOW = new Date("2026-07-17T16:00:00.000Z");
export const TEST_ISSUER = "https://issuer-a.example";
export const TEST_AUDIENCE = "https://worm.example";
export const TEST_CLIENT_ID = "worm-web";
export const TEST_CREATOR =
  "https://artist.example/.well-known/comb-creator";
export const TEST_BENEFIT =
  "https://artist.example/benefits/supporter-shelf";

export async function createTestSigningKey(
  kid = "key-2026-07"
): Promise<CombSigningKey> {
  return generateCombSigningKey(kid);
}

export function createTestJwks(keys: readonly CombSigningKey[]) {
  return createCombJwks(keys);
}

export function issueTestToken(
  signingKey: CombSigningKey,
  overrides: Partial<IssueEntitlementTokenInput> = {}
): Promise<string> {
  const input: IssueEntitlementTokenInput = {
    issuer: TEST_ISSUER,
    subject: "pairwise-supporter-1",
    audience: TEST_AUDIENCE,
    clientId: TEST_CLIENT_ID,
    jwtId: "tok-test-1",
    now: TEST_NOW,
    lifetimeSeconds: 600,
    grants: [
      {
        id: "grant-test-1",
        creator: TEST_CREATOR,
        benefits: [TEST_BENEFIT],
        valid_until: "2026-08-17T16:00:00.000Z"
      }
    ],
    ...overrides
  };
  return issueEntitlementToken(input, signingKey);
}
