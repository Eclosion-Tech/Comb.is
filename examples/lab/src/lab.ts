// SPDX-License-Identifier: Apache-2.0

import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from "node:http";
import type { AddressInfo } from "node:net";
import { verifyEntitlementToken } from "@comb-is/consumer";
import {
  createCombJwks,
  generateCombSigningKey,
  issueEntitlementToken,
  type CombSigningKey
} from "@comb-is/issuer";
import { SignJWT, createLocalJWKSet, jwtVerify, type JWK } from "jose";

const CLIENT_ID = "comb-lab-consumer";
const SUPPORTER_SUBJECT = "pairwise-lab-supporter";
const BENEFIT_PATH = "/benefits/laboratory-access";

interface AuthorizationCodeRecord {
  clientId: string;
  codeChallenge: string;
  creator: string;
  nonce: string;
  redirectUri: string;
  resource: string;
  expiresAt: number;
}

interface IssuerState {
  baseUrl: string;
  consumerBaseUrl: string;
  consumerRedirectUri: string;
  currentKey: CombSigningKey;
  keys: CombSigningKey[];
  grantActive: boolean;
  codes: Map<string, AuthorizationCodeRecord>;
}

interface PendingAuthorization {
  codeVerifier: string;
  nonce: string;
  createdAt: number;
}

interface ConsumerSession {
  subject: string;
  grantId: string;
  creator: string;
  benefit: string;
}

interface ConsumerState {
  baseUrl: string;
  issuerBaseUrl: string;
  pending: Map<string, PendingAuthorization>;
  sessions: Map<string, ConsumerSession>;
}

export interface CombLabOptions {
  issuerPort?: number;
  consumerPort?: number;
}

export interface RunningCombLab {
  issuerBaseUrl: string;
  consumerBaseUrl: string;
  close(): Promise<void>;
}

function creatorUrl(state: IssuerState): string {
  return state.baseUrl + "/.well-known/comb-creator";
}

function benefitUrl(state: IssuerState): string {
  return state.baseUrl + BENEFIT_PATH;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function randomToken(bytes = 32): string {
  return base64Url(randomBytes(bytes));
}

function requestUrl(request: IncomingMessage): URL {
  return new URL(
    request.url ?? "/",
    "http://" + (request.headers.host ?? "127.0.0.1")
  );
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown
): void {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body, null, 2));
}

function sendHtml(
  response: ServerResponse,
  status: number,
  body: string
): void {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "text/html; charset=utf-8"
  });
  response.end(body);
}

function redirect(response: ServerResponse, location: string): void {
  response.writeHead(302, {
    "cache-control": "no-store",
    location
  });
  response.end();
}

async function readForm(request: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function documentShell(title: string, content: string): string {
  return [
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
    "<title>",
    escapeHtml(title),
    "</title><style>",
    "body{margin:0;background:#12120f;color:#fffaf0;font-family:Arial,sans-serif;",
    "min-height:100vh;display:grid;place-items:center}main{width:min(42rem,calc(100% - 2rem));",
    "border:1px solid #4b493e;padding:clamp(1.5rem,5vw,4rem);box-sizing:border-box}",
    "p{color:#b9b5a8;line-height:1.6}a{display:inline-block;background:#f3b622;color:#12120f;",
    "padding:.9rem 1.1rem;text-decoration:none;font:700 .8rem monospace;text-transform:uppercase}",
    "code{color:#d8ff4f}small{font-family:monospace;color:#8d897e}</style></head><body><main>",
    content,
    "</main></body></html>"
  ].join("");
}

function oauthError(
  response: ServerResponse,
  status: number,
  error: string,
  description: string
): void {
  sendJson(response, status, {
    error,
    error_description: description
  });
}

async function issueIdToken(
  state: IssuerState,
  record: AuthorizationCodeRecord
): Promise<string> {
  const issuedAt = nowSeconds();
  return new SignJWT({ nonce: record.nonce })
    .setProtectedHeader({
      alg: "RS256",
      kid: state.currentKey.kid,
      typ: "JWT"
    })
    .setIssuer(state.baseUrl)
    .setSubject(SUPPORTER_SUBJECT)
    .setAudience(record.clientId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 300)
    .setJti("id-" + randomUUID())
    .sign(state.currentKey.privateKey);
}

async function handleIssuer(
  request: IncomingMessage,
  response: ServerResponse,
  state: IssuerState
): Promise<void> {
  const url = requestUrl(request);

  if (request.method === "GET" && url.pathname === "/.well-known/comb") {
    sendJson(response, 200, {
      comb_version: "0.1",
      issuer: state.baseUrl,
      authorization_endpoint: state.baseUrl + "/oauth/authorize",
      token_endpoint: state.baseUrl + "/oauth/token",
      jwks_uri: state.baseUrl + "/.well-known/jwks.json",
      openid_configuration:
        state.baseUrl + "/.well-known/openid-configuration",
      claim_signing_alg_values_supported: ["RS256"],
      scopes_supported: ["openid", "comb:entitlements"]
    });
    return;
  }

  if (
    request.method === "GET" &&
    url.pathname === "/.well-known/openid-configuration"
  ) {
    sendJson(response, 200, {
      issuer: state.baseUrl,
      authorization_endpoint: state.baseUrl + "/oauth/authorize",
      token_endpoint: state.baseUrl + "/oauth/token",
      jwks_uri: state.baseUrl + "/.well-known/jwks.json",
      response_types_supported: ["code"],
      subject_types_supported: ["pairwise"],
      id_token_signing_alg_values_supported: ["RS256"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["openid", "comb:entitlements"]
    });
    return;
  }

  if (
    request.method === "GET" &&
    url.pathname === "/.well-known/jwks.json"
  ) {
    sendJson(response, 200, createCombJwks(state.keys));
    return;
  }

  if (
    request.method === "GET" &&
    url.pathname === "/.well-known/comb-creator"
  ) {
    sendJson(response, 200, {
      comb_version: "0.1",
      creator: creatorUrl(state),
      display_name: "Comb Laboratory Creator",
      issuers: [
        {
          issuer: state.baseUrl,
          creator_ref: "creator-lab-1",
          not_before: "2026-01-01T00:00:00.000Z",
          not_after: null
        }
      ]
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/oauth/authorize") {
    const clientId = url.searchParams.get("client_id");
    const redirectUri = url.searchParams.get("redirect_uri");
    const stateParam = url.searchParams.get("state");
    const nonce = url.searchParams.get("nonce");
    const codeChallenge = url.searchParams.get("code_challenge");
    const creator = url.searchParams.get("comb_creator");
    const benefit = url.searchParams.get("comb_benefit");
    const resource = url.searchParams.get("resource");
    const scopes = new Set((url.searchParams.get("scope") ?? "").split(" "));

    const valid =
      url.searchParams.get("response_type") === "code" &&
      clientId === CLIENT_ID &&
      redirectUri === state.consumerRedirectUri &&
      url.searchParams.get("code_challenge_method") === "S256" &&
      typeof stateParam === "string" &&
      stateParam.length > 0 &&
      typeof nonce === "string" &&
      nonce.length > 0 &&
      typeof codeChallenge === "string" &&
      codeChallenge.length > 0 &&
      creator === creatorUrl(state) &&
      benefit === benefitUrl(state) &&
      resource === state.consumerBaseUrl &&
      scopes.has("openid") &&
      scopes.has("comb:entitlements");

    if (!valid) {
      oauthError(
        response,
        400,
        "invalid_request",
        "The laboratory authorization request is invalid."
      );
      return;
    }

    if (!state.grantActive) {
      const denied = new URL(redirectUri);
      denied.searchParams.set("error", "access_denied");
      denied.searchParams.set(
        "error_description",
        "The seeded laboratory Grant has lapsed."
      );
      denied.searchParams.set("state", stateParam);
      redirect(response, denied.toString());
      return;
    }

    const code = randomToken();
    state.codes.set(code, {
      clientId,
      codeChallenge,
      creator,
      nonce,
      redirectUri,
      resource,
      expiresAt: nowSeconds() + 60
    });

    const callback = new URL(redirectUri);
    callback.searchParams.set("code", code);
    callback.searchParams.set("state", stateParam);
    redirect(response, callback.toString());
    return;
  }

  if (request.method === "POST" && url.pathname === "/oauth/token") {
    const form = await readForm(request);
    const code = form.get("code");
    const record = code ? state.codes.get(code) : undefined;

    if (
      code === null ||
      form.get("grant_type") !== "authorization_code" ||
      record === undefined ||
      record.expiresAt < nowSeconds() ||
      form.get("client_id") !== record.clientId ||
      form.get("redirect_uri") !== record.redirectUri
    ) {
      oauthError(response, 400, "invalid_grant", "The code is invalid.");
      return;
    }

    const verifier = form.get("code_verifier") ?? "";
    if (pkceChallenge(verifier) !== record.codeChallenge) {
      oauthError(
        response,
        400,
        "invalid_grant",
        "PKCE verification failed."
      );
      return;
    }

    state.codes.delete(code);
    if (!state.grantActive) {
      oauthError(response, 400, "invalid_grant", "The Grant has lapsed.");
      return;
    }

    const accessToken = await issueEntitlementToken(
      {
        issuer: state.baseUrl,
        subject: SUPPORTER_SUBJECT,
        audience: record.resource,
        clientId: record.clientId,
        jwtId: "tok-" + randomUUID(),
        lifetimeSeconds: 600,
        grants: [
          {
            id: "grant-lab-1",
            creator: record.creator,
            benefits: [benefitUrl(state)],
            valid_until: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString()
          }
        ]
      },
      state.currentKey
    );

    sendJson(response, 200, {
      access_token: accessToken,
      id_token: await issueIdToken(state, record),
      token_type: "Bearer",
      expires_in: 600,
      scope: "openid comb:entitlements"
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/lab/status") {
    sendJson(response, 200, {
      issuer: state.baseUrl,
      creator: creatorUrl(state),
      benefit: benefitUrl(state),
      grant_active: state.grantActive,
      signing_kids: state.keys.map((key) => key.kid)
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/lab/rotate") {
    const nextKey = await generateCombSigningKey(
      "lab-key-" + String(state.keys.length + 1)
    );
    state.currentKey = nextKey;
    state.keys.push(nextKey);
    sendJson(response, 200, {
      active_kid: nextKey.kid,
      published_kids: state.keys.map((key) => key.kid)
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/lab/lapse") {
    state.grantActive = false;
    sendJson(response, 200, { grant_active: false });
    return;
  }

  if (request.method === "POST" && url.pathname === "/lab/restore") {
    state.grantActive = true;
    sendJson(response, 200, { grant_active: true });
    return;
  }

  sendJson(response, 404, { error: "not_found" });
}

function readCookie(request: IncomingMessage, name: string): string | null {
  const cookies = (request.headers.cookie ?? "").split(";");
  for (const cookie of cookies) {
    const [key, ...parts] = cookie.trim().split("=");
    if (key === name) {
      return parts.join("=");
    }
  }
  return null;
}

function consumerHome(state: ConsumerState): string {
  return documentShell(
    "Comb Consumer Laboratory",
    [
      "<small>CONSUMER B · ",
      escapeHtml(state.baseUrl),
      "</small><h1>Product-neutral Comb laboratory</h1>",
      "<p>This Consumer has its own origin and state. It discovers Issuer A, ",
      "performs Authorization Code with PKCE, validates the ID token, then ",
      "verifies a creator-scoped Comb entitlement.</p>",
      "<p><a href=\"/login\">Run the handshake →</a></p>",
      "<small>Issuer: ",
      escapeHtml(state.issuerBaseUrl),
      "</small>"
    ].join("")
  );
}

async function handleConsumer(
  request: IncomingMessage,
  response: ServerResponse,
  state: ConsumerState
): Promise<void> {
  const url = requestUrl(request);

  if (request.method === "GET" && url.pathname === "/") {
    sendHtml(response, 200, consumerHome(state));
    return;
  }

  if (request.method === "GET" && url.pathname === "/login") {
    const stateParam = randomToken();
    const codeVerifier = randomToken(48);
    const nonce = randomToken();
    state.pending.set(stateParam, {
      codeVerifier,
      nonce,
      createdAt: nowSeconds()
    });

    const authorization = new URL(
      state.issuerBaseUrl + "/oauth/authorize"
    );
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("client_id", CLIENT_ID);
    authorization.searchParams.set(
      "redirect_uri",
      state.baseUrl + "/callback"
    );
    authorization.searchParams.set(
      "scope",
      "openid comb:entitlements"
    );
    authorization.searchParams.set("state", stateParam);
    authorization.searchParams.set("nonce", nonce);
    authorization.searchParams.set(
      "code_challenge",
      pkceChallenge(codeVerifier)
    );
    authorization.searchParams.set("code_challenge_method", "S256");
    authorization.searchParams.set("resource", state.baseUrl);
    authorization.searchParams.set(
      "comb_creator",
      state.issuerBaseUrl + "/.well-known/comb-creator"
    );
    authorization.searchParams.set(
      "comb_benefit",
      state.issuerBaseUrl + BENEFIT_PATH
    );
    redirect(response, authorization.toString());
    return;
  }

  if (request.method === "GET" && url.pathname === "/callback") {
    const stateParam = url.searchParams.get("state");
    const pending = stateParam ? state.pending.get(stateParam) : undefined;

    if (
      stateParam === null ||
      pending === undefined ||
      pending.createdAt + 120 < nowSeconds()
    ) {
      sendHtml(
        response,
        400,
        documentShell(
          "Invalid authorization state",
          "<h1>State validation failed.</h1>"
        )
      );
      return;
    }
    state.pending.delete(stateParam);

    const authorizationError = url.searchParams.get("error");
    if (authorizationError !== null) {
      const description =
        url.searchParams.get("error_description") ?? authorizationError;
      sendHtml(
        response,
        403,
        documentShell(
          "Benefit not granted",
          "<small>ACCESS DENIED</small><h1>The Benefit is unavailable.</h1><p>" +
            escapeHtml(description) +
            "</p><a href=\"/\">Return to the Consumer</a>"
        )
      );
      return;
    }

    const code = url.searchParams.get("code");
    if (code === null) {
      sendHtml(
        response,
        400,
        documentShell("Missing code", "<h1>No authorization code.</h1>")
      );
      return;
    }

    const discoveryResponse = await fetch(
      state.issuerBaseUrl + "/.well-known/comb"
    );
    const discovery = (await discoveryResponse.json()) as {
      issuer: string;
      token_endpoint: string;
      jwks_uri: string;
    };
    if (discovery.issuer !== state.issuerBaseUrl) {
      throw new Error("Issuer discovery exact-match check failed");
    }

    const tokenResponse = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: CLIENT_ID,
        redirect_uri: state.baseUrl + "/callback",
        code_verifier: pending.codeVerifier
      })
    });
    if (!tokenResponse.ok) {
      throw new Error(
        "Token exchange failed with status " +
          String(tokenResponse.status)
      );
    }
    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      id_token: string;
    };

    const jwksResponse = await fetch(discovery.jwks_uri);
    const jwks = (await jwksResponse.json()) as { keys: JWK[] };
    const idVerification = await jwtVerify(
      tokens.id_token,
      createLocalJWKSet(jwks),
      {
        algorithms: ["RS256"],
        audience: CLIENT_ID,
        issuer: state.issuerBaseUrl
      }
    );
    if (idVerification.payload.nonce !== pending.nonce) {
      throw new Error("OIDC nonce validation failed");
    }

    const creator = state.issuerBaseUrl + "/.well-known/comb-creator";
    const creatorResponse = await fetch(creator);
    const creatorDocument = (await creatorResponse.json()) as {
      creator: string;
      issuers: Array<{
        issuer: string;
        not_before: string;
        not_after: string | null;
      }>;
    };
    if (creatorDocument.creator !== creator) {
      throw new Error("Creator document identifier mismatch");
    }
    const delegation = creatorDocument.issuers.find(
      (candidate) => candidate.issuer === state.issuerBaseUrl
    );
    if (delegation === undefined) {
      throw new Error("Creator document does not delegate this Issuer");
    }

    const benefit = state.issuerBaseUrl + BENEFIT_PATH;
    const verified = await verifyEntitlementToken(tokens.access_token, {
      expectedIssuer: state.issuerBaseUrl,
      expectedAudience: state.baseUrl,
      expectedClientId: CLIENT_ID,
      requiredCreator: creator,
      requiredBenefit: benefit,
      trustedDelegations: [
        {
          issuer: delegation.issuer,
          creator,
          notBefore: delegation.not_before,
          notAfter: delegation.not_after
        }
      ],
      jwks
    });

    const sessionId = randomToken();
    state.sessions.set(sessionId, {
      subject: verified.subject,
      grantId: verified.grant.id,
      creator,
      benefit
    });
    response.setHeader(
      "set-cookie",
      "comb_lab_session=" +
        sessionId +
        "; HttpOnly; SameSite=Lax; Path=/; Max-Age=600"
    );
    redirect(response, state.baseUrl + "/unlocked");
    return;
  }

  if (request.method === "GET" && url.pathname === "/unlocked") {
    const sessionId = readCookie(request, "comb_lab_session");
    const session = sessionId ? state.sessions.get(sessionId) : undefined;
    if (session === undefined) {
      sendHtml(
        response,
        401,
        documentShell(
          "No Comb session",
          "<h1>No verified entitlement.</h1><a href=\"/login\">Try again</a>"
        )
      );
      return;
    }

    sendHtml(
      response,
      200,
      documentShell(
        "Benefit unlocked",
        [
          "<small>VERIFIED BY CONSUMER B</small>",
          "<h1>Benefit unlocked.</h1>",
          "<p>Issuer discovery, OIDC nonce, PKCE, JWKS signature, audience, ",
          "client, Creator delegation, and Benefit checks all passed.</p>",
          "<p><code>",
          escapeHtml(session.benefit),
          "</code></p><small>Grant ",
          escapeHtml(session.grantId),
          " · Subject ",
          escapeHtml(session.subject),
          "</small>"
        ].join("")
      )
    );
    return;
  }

  sendJson(response, 404, { error: "not_found" });
}

function createHandledServer(
  handler: (
    request: IncomingMessage,
    response: ServerResponse
  ) => Promise<void>
): Server {
  return createServer((request, response) => {
    void handler(request, response).catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Unknown laboratory error";
      if (!response.headersSent) {
        sendJson(response, 500, {
          error: "lab_failure",
          error_description: message
        });
      } else {
        response.end();
      }
    });
  });
}

async function listen(server: Server, port: number): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  return "http://127.0.0.1:" + String(address.port);
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function startCombLab(
  options: CombLabOptions = {}
): Promise<RunningCombLab> {
  const firstKey = await generateCombSigningKey("lab-key-1");
  const issuerState: IssuerState = {
    baseUrl: "",
    consumerBaseUrl: "",
    consumerRedirectUri: "",
    currentKey: firstKey,
    keys: [firstKey],
    grantActive: true,
    codes: new Map()
  };
  const issuerServer = createHandledServer((request, response) =>
    handleIssuer(request, response, issuerState)
  );
  issuerState.baseUrl = await listen(
    issuerServer,
    options.issuerPort ?? 4101
  );

  const consumerState: ConsumerState = {
    baseUrl: "",
    issuerBaseUrl: issuerState.baseUrl,
    pending: new Map(),
    sessions: new Map()
  };
  const consumerServer = createHandledServer((request, response) =>
    handleConsumer(request, response, consumerState)
  );

  try {
    consumerState.baseUrl = await listen(
      consumerServer,
      options.consumerPort ?? 4102
    );
  } catch (error) {
    await closeServer(issuerServer);
    throw error;
  }

  issuerState.consumerBaseUrl = consumerState.baseUrl;
  issuerState.consumerRedirectUri =
    consumerState.baseUrl + "/callback";

  return {
    issuerBaseUrl: issuerState.baseUrl,
    consumerBaseUrl: consumerState.baseUrl,
    async close() {
      await Promise.all([
        closeServer(consumerServer),
        closeServer(issuerServer)
      ]);
    }
  };
}
