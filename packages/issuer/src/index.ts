// SPDX-License-Identifier: Apache-2.0

import {
  COMB_SIGNING_ALGORITHM,
  COMB_TOKEN_TYPE,
  COMB_VERSION,
  MAX_TOKEN_LIFETIME_SECONDS,
  parseEntitlementClaims,
  type CombEntitlementClaims,
  type CombGrantClaim
} from "@comb-is/core";
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  type JWK
} from "jose";

export interface CombSigningKey {
  kid: string;
  privateKey: CryptoKey;
  publicJwk: JWK;
}

export interface CombJwks {
  keys: JWK[];
}

export interface IssueEntitlementTokenInput {
  issuer: string;
  subject: string;
  audience: string;
  clientId: string;
  jwtId: string;
  grants: CombGrantClaim[];
  now?: Date;
  lifetimeSeconds?: number;
}

export async function generateCombSigningKey(
  kid: string
): Promise<CombSigningKey> {
  if (kid.length === 0) {
    throw new Error("kid must be a non-empty string");
  }

  const { privateKey, publicKey } = await generateKeyPair(
    COMB_SIGNING_ALGORITHM,
    {
      modulusLength: 2048
    }
  );
  const exported = await exportJWK(publicKey);

  return {
    kid,
    privateKey,
    publicJwk: {
      ...exported,
      alg: COMB_SIGNING_ALGORITHM,
      kid,
      use: "sig"
    }
  };
}

export function createCombJwks(
  keys: readonly CombSigningKey[]
): CombJwks {
  return {
    keys: keys.map((key) => ({ ...key.publicJwk }))
  };
}

export async function issueEntitlementToken(
  input: IssueEntitlementTokenInput,
  signingKey: CombSigningKey
): Promise<string> {
  const now = input.now ?? new Date();
  const issuedAt = Math.floor(now.getTime() / 1000);
  const lifetimeSeconds =
    input.lifetimeSeconds ?? MAX_TOKEN_LIFETIME_SECONDS;

  if (
    !Number.isSafeInteger(lifetimeSeconds) ||
    lifetimeSeconds <= 0 ||
    lifetimeSeconds > MAX_TOKEN_LIFETIME_SECONDS
  ) {
    throw new Error(
      "lifetimeSeconds must be between 1 and " +
        MAX_TOKEN_LIFETIME_SECONDS
    );
  }

  const claims: CombEntitlementClaims = parseEntitlementClaims({
    iss: input.issuer,
    sub: input.subject,
    aud: input.audience,
    client_id: input.clientId,
    iat: issuedAt,
    exp: issuedAt + lifetimeSeconds,
    jti: input.jwtId,
    comb: {
      version: COMB_VERSION,
      grants: input.grants
    }
  });

  return new SignJWT({
    client_id: claims.client_id,
    comb: claims.comb
  })
    .setProtectedHeader({
      alg: COMB_SIGNING_ALGORITHM,
      kid: signingKey.kid,
      typ: COMB_TOKEN_TYPE
    })
    .setIssuer(claims.iss)
    .setSubject(claims.sub)
    .setAudience(claims.aud)
    .setIssuedAt(claims.iat)
    .setExpirationTime(claims.exp)
    .setJti(claims.jti)
    .sign(signingKey.privateKey);
}
