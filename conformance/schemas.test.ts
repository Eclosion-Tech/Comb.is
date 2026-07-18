// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule, { type FormatsPlugin } from "ajv-formats";
import { describe, expect, it } from "vitest";
import {
  TEST_AUDIENCE,
  TEST_BENEFIT,
  TEST_CLIENT_ID,
  TEST_CREATOR,
  TEST_ISSUER
} from "./fixtures/test-issuer.js";

const addFormats = addFormatsModule as unknown as FormatsPlugin;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

function loadSchema(name: string): object {
  const url = new URL(
    "../packages/core/schemas/" + name + ".schema.json",
    import.meta.url
  );
  return JSON.parse(readFileSync(url, "utf8")) as object;
}

describe("Comb v0 JSON Schemas", () => {
  it("accepts the canonical discovery shape", () => {
    const validate = ajv.compile(loadSchema("discovery"));
    const valid = validate({
      comb_version: "0.1",
      issuer: TEST_ISSUER,
      authorization_endpoint: TEST_ISSUER + "/oauth/authorize",
      token_endpoint: TEST_ISSUER + "/oauth/token",
      jwks_uri: TEST_ISSUER + "/.well-known/jwks.json",
      openid_configuration:
        TEST_ISSUER + "/.well-known/openid-configuration",
      claim_signing_alg_values_supported: ["RS256"],
      scopes_supported: ["openid", "comb:entitlements"]
    });

    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
  });

  it("accepts the canonical creator delegation shape", () => {
    const validate = ajv.compile(loadSchema("creator-document"));
    const valid = validate({
      comb_version: "0.1",
      creator: TEST_CREATOR,
      display_name: "Example Artist",
      issuers: [
        {
          issuer: TEST_ISSUER,
          creator_ref: "creator-test-1",
          not_before: "2026-01-01T00:00:00.000Z",
          not_after: null
        }
      ]
    });

    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
  });

  it("accepts minimal claims and rejects sensitive extras", () => {
    const validate = ajv.compile(loadSchema("entitlement-claims"));
    const claims = {
      iss: TEST_ISSUER,
      sub: "pairwise-supporter-1",
      aud: TEST_AUDIENCE,
      client_id: TEST_CLIENT_ID,
      iat: 1784304000,
      exp: 1784304600,
      jti: "tok-test-1",
      comb: {
        version: "0.1",
        grants: [
          {
            id: "grant-test-1",
            creator: TEST_CREATOR,
            benefits: [TEST_BENEFIT],
            valid_until: "2026-08-17T16:00:00.000Z"
          }
        ]
      }
    };

    expect(validate(claims)).toBe(true);
    expect(validate({ ...claims, email: "supporter@example.com" })).toBe(
      false
    );
  });
});
