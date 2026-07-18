// SPDX-License-Identifier: Apache-2.0

import {
  COMB_SIGNING_ALGORITHM,
  COMB_TOKEN_TYPE,
  MAX_TOKEN_LIFETIME_SECONDS,
  parseEntitlementClaims,
  type CombEntitlementClaims,
  type CombGrantClaim
} from "@comb-is/core";
import {
  createLocalJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  type JWK
} from "jose";

export interface CombJwks {
  keys: JWK[];
}

export interface TrustedCreatorDelegation {
  issuer: string;
  creator: string;
  notBefore?: string;
  notAfter?: string | null;
}

export interface VerifyEntitlementTokenOptions {
  expectedIssuer: string;
  expectedAudience: string;
  expectedClientId: string;
  requiredCreator: string;
  requiredBenefit: string;
  trustedDelegations: readonly TrustedCreatorDelegation[];
  jwks: CombJwks;
  now?: Date;
  clockToleranceSeconds?: number;
  maxTokenLifetimeSeconds?: number;
}

export interface VerifiedEntitlement {
  subject: string;
  claims: CombEntitlementClaims;
  grant: CombGrantClaim;
}

export class CombVerificationError extends Error {
  override name = "CombVerificationError";
}

function fail(message: string): never {
  throw new CombVerificationError(message);
}

function parseOptionalDate(value: string | null | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    fail("trusted delegation contains an invalid date-time");
  }
  return Math.floor(milliseconds / 1000);
}

function delegationCovers(
  delegation: TrustedCreatorDelegation,
  issuer: string,
  creator: string,
  issuedAt: number
): boolean {
  if (
    delegation.issuer !== issuer ||
    delegation.creator !== creator
  ) {
    return false;
  }

  const notBefore = parseOptionalDate(delegation.notBefore);
  const notAfter = parseOptionalDate(delegation.notAfter);
  return (
    (notBefore === null || issuedAt >= notBefore) &&
    (notAfter === null || issuedAt <= notAfter)
  );
}

export async function verifyEntitlementToken(
  token: string,
  options: VerifyEntitlementTokenOptions
): Promise<VerifiedEntitlement> {
  const untrustedHeader = decodeProtectedHeader(token);
  if (untrustedHeader.alg !== COMB_SIGNING_ALGORITHM) {
    fail("token must use " + COMB_SIGNING_ALGORITHM);
  }
  if (untrustedHeader.typ !== COMB_TOKEN_TYPE) {
    fail("token typ must be " + COMB_TOKEN_TYPE);
  }
  if (
    typeof untrustedHeader.kid !== "string" ||
    untrustedHeader.kid.length === 0
  ) {
    fail("token must contain a non-empty kid");
  }
  if ("jku" in untrustedHeader || "x5u" in untrustedHeader) {
    fail("token-supplied key locations are forbidden");
  }

  const now = options.now ?? new Date();
  const clockToleranceSeconds = options.clockToleranceSeconds ?? 30;
  if (
    !Number.isFinite(clockToleranceSeconds) ||
    clockToleranceSeconds < 0
  ) {
    throw new Error("clockToleranceSeconds must not be negative");
  }

  const { payload } = await jwtVerify(
    token,
    createLocalJWKSet(options.jwks),
    {
      algorithms: [COMB_SIGNING_ALGORITHM],
      audience: options.expectedAudience,
      clockTolerance: clockToleranceSeconds,
      currentDate: now,
      issuer: options.expectedIssuer
    }
  );

  const claims = parseEntitlementClaims(payload);
  if (claims.client_id !== options.expectedClientId) {
    fail("client_id does not match the configured Consumer");
  }

  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (claims.iat > nowSeconds + clockToleranceSeconds) {
    fail("iat is in the future");
  }

  const maxTokenLifetimeSeconds =
    options.maxTokenLifetimeSeconds ?? MAX_TOKEN_LIFETIME_SECONDS;
  if (
    !Number.isSafeInteger(maxTokenLifetimeSeconds) ||
    maxTokenLifetimeSeconds <= 0 ||
    maxTokenLifetimeSeconds > MAX_TOKEN_LIFETIME_SECONDS
  ) {
    throw new Error(
      "maxTokenLifetimeSeconds must be between 1 and " +
        MAX_TOKEN_LIFETIME_SECONDS
    );
  }
  if (claims.exp - claims.iat > maxTokenLifetimeSeconds) {
    fail("token exceeds the Consumer lifetime policy");
  }

  const delegationTrusted = options.trustedDelegations.some((delegation) =>
    delegationCovers(
      delegation,
      claims.iss,
      options.requiredCreator,
      claims.iat
    )
  );
  if (!delegationTrusted) {
    fail("creator and Issuer are not trusted for the token issuance time");
  }

  const grant = claims.comb.grants.find(
    (candidate) =>
      candidate.creator === options.requiredCreator &&
      candidate.benefits.includes(options.requiredBenefit)
  );
  if (grant === undefined) {
    fail("required Benefit is absent");
  }

  return {
    subject: claims.sub,
    claims,
    grant
  };
}
