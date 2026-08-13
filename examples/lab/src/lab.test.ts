// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import test from "node:test";
import { startCombLab, type RunningCombLab } from "./lab.js";

interface HandshakeResult {
  callbackStatus: number;
  callbackBody: string;
  unlockedStatus?: number;
  unlockedBody?: string;
}

function requiredLocation(response: Response): string {
  const location = response.headers.get("location");
  assert.ok(location, "expected a redirect location");
  return location;
}

async function runHandshake(
  lab: RunningCombLab
): Promise<HandshakeResult> {
  const login = await fetch(lab.consumerBaseUrl + "/login", {
    redirect: "manual"
  });
  assert.equal(login.status, 302);

  const authorization = await fetch(requiredLocation(login), {
    redirect: "manual"
  });
  assert.equal(authorization.status, 302);

  const callback = await fetch(requiredLocation(authorization), {
    redirect: "manual"
  });
  const callbackBody = await callback.text();
  if (callback.status !== 302) {
    return {
      callbackStatus: callback.status,
      callbackBody
    };
  }

  const setCookie = callback.headers.get("set-cookie");
  assert.ok(setCookie, "expected the Consumer session cookie");
  const cookie = setCookie.split(";")[0];
  assert.ok(cookie, "expected a cookie value");
  const unlocked = await fetch(requiredLocation(callback), {
    headers: { cookie }
  });

  return {
    callbackStatus: callback.status,
    callbackBody,
    unlockedStatus: unlocked.status,
    unlockedBody: await unlocked.text()
  };
}

test("the product-neutral HTTP laboratory completes F0", async (context) => {
  const lab = await startCombLab({
    issuerPort: 0,
    consumerPort: 0
  });
  context.after(async () => {
    await lab.close();
  });

  assert.notEqual(lab.issuerBaseUrl, lab.consumerBaseUrl);

  const discoveryResponse = await fetch(
    lab.issuerBaseUrl + "/.well-known/comb"
  );
  assert.equal(discoveryResponse.status, 200);
  const discovery = (await discoveryResponse.json()) as {
    issuer: string;
    jwks_uri: string;
  };
  assert.equal(discovery.issuer, lab.issuerBaseUrl);

  const initial = await runHandshake(lab);
  assert.equal(initial.callbackStatus, 302);
  assert.equal(initial.unlockedStatus, 200);
  assert.match(initial.unlockedBody ?? "", /Benefit unlocked/);

  const rotation = await fetch(lab.issuerBaseUrl + "/lab/rotate", {
    method: "POST"
  });
  assert.equal(rotation.status, 200);
  const rotationBody = (await rotation.json()) as {
    published_kids: string[];
  };
  assert.deepEqual(rotationBody.published_kids, [
    "lab-key-1",
    "lab-key-2"
  ]);

  const afterRotation = await runHandshake(lab);
  assert.equal(afterRotation.unlockedStatus, 200);
  assert.match(afterRotation.unlockedBody ?? "", /Benefit unlocked/);

  const lapse = await fetch(lab.issuerBaseUrl + "/lab/lapse", {
    method: "POST"
  });
  assert.equal(lapse.status, 200);

  const afterLapse = await runHandshake(lab);
  assert.equal(afterLapse.callbackStatus, 403);
  assert.match(afterLapse.callbackBody, /Benefit is unavailable/);
  assert.match(afterLapse.callbackBody, /Grant has lapsed/);
});
