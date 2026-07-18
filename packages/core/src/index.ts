// SPDX-License-Identifier: Apache-2.0

export const COMB_VERSION = "0.1" as const;
export const COMB_TOKEN_TYPE = "at+jwt" as const;
export const COMB_SIGNING_ALGORITHM = "RS256" as const;
export const MAX_TOKEN_LIFETIME_SECONDS = 600;

export interface CombGrantClaim {
  id: string;
  creator: string;
  benefits: string[];
  valid_until: string;
}

export interface CombEntitlementClaims {
  iss: string;
  sub: string;
  aud: string;
  client_id: string;
  iat: number;
  exp: number;
  jti: string;
  comb: {
    version: typeof COMB_VERSION;
    grants: CombGrantClaim[];
  };
}

export class CombClaimValidationError extends Error {
  override name = "CombClaimValidationError";
}

function fail(message: string): never {
  throw new CombClaimValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(
  value: unknown,
  field: string
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    fail(field + " must be an object");
  }
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  const allowedKeys = new Set(allowed);
  const unexpected = Object.keys(value).find((key) => !allowedKeys.has(key));
  if (unexpected !== undefined) {
    fail(field + " contains unexpected field " + unexpected);
  }
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    fail(field + " must be a non-empty string");
  }
  return value;
}

function readInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    fail(field + " must be a safe integer");
  }
  return value;
}

function readAbsoluteUri(value: unknown, field: string): string {
  const uri = readString(value, field);
  try {
    const parsed = new URL(uri);
    if (parsed.protocol.length === 0) {
      fail(field + " must be an absolute URI");
    }
  } catch {
    fail(field + " must be an absolute URI");
  }
  return uri;
}

function readDateTime(value: unknown, field: string): string {
  const dateTime = readString(value, field);
  if (!dateTime.includes("T") || !Number.isFinite(Date.parse(dateTime))) {
    fail(field + " must be an RFC 3339 date-time");
  }
  return dateTime;
}

function parseGrant(value: unknown, index: number): CombGrantClaim {
  const field = "comb.grants[" + index + "]";
  assertRecord(value, field);
  assertAllowedKeys(
    value,
    ["id", "creator", "benefits", "valid_until"],
    field
  );

  if (!Array.isArray(value.benefits) || value.benefits.length === 0) {
    fail(field + ".benefits must be a non-empty array");
  }

  const benefits = value.benefits.map((benefit, benefitIndex) =>
    readString(benefit, field + ".benefits[" + benefitIndex + "]")
  );
  if (new Set(benefits).size !== benefits.length) {
    fail(field + ".benefits must not contain duplicates");
  }

  return {
    id: readString(value.id, field + ".id"),
    creator: readAbsoluteUri(value.creator, field + ".creator"),
    benefits,
    valid_until: readDateTime(value.valid_until, field + ".valid_until")
  };
}

export function parseEntitlementClaims(
  value: unknown
): CombEntitlementClaims {
  assertRecord(value, "claims");
  assertAllowedKeys(
    value,
    ["iss", "sub", "aud", "client_id", "iat", "exp", "jti", "comb"],
    "claims"
  );

  assertRecord(value.comb, "comb");
  assertAllowedKeys(value.comb, ["version", "grants"], "comb");
  if (value.comb.version !== COMB_VERSION) {
    fail("comb.version must be " + COMB_VERSION);
  }
  if (!Array.isArray(value.comb.grants) || value.comb.grants.length === 0) {
    fail("comb.grants must be a non-empty array");
  }

  const iat = readInteger(value.iat, "iat");
  const exp = readInteger(value.exp, "exp");
  if (iat < 0) {
    fail("iat must not be negative");
  }
  if (exp <= iat) {
    fail("exp must be later than iat");
  }
  if (exp - iat > MAX_TOKEN_LIFETIME_SECONDS) {
    fail(
      "token lifetime must not exceed " +
        MAX_TOKEN_LIFETIME_SECONDS +
        " seconds"
    );
  }

  return {
    iss: readAbsoluteUri(value.iss, "iss"),
    sub: readString(value.sub, "sub"),
    aud: readAbsoluteUri(value.aud, "aud"),
    client_id: readString(value.client_id, "client_id"),
    iat,
    exp,
    jti: readString(value.jti, "jti"),
    comb: {
      version: COMB_VERSION,
      grants: value.comb.grants.map(parseGrant)
    }
  };
}
