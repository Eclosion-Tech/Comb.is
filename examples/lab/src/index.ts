// SPDX-License-Identifier: Apache-2.0

import { startCombLab } from "./lab.js";

const issuerPort = Number(process.env.COMB_LAB_ISSUER_PORT ?? "4101");
const consumerPort = Number(process.env.COMB_LAB_CONSUMER_PORT ?? "4102");
const lab = await startCombLab({ issuerPort, consumerPort });

console.log("Comb laboratory is running.");
console.log("Issuer A:  " + lab.issuerBaseUrl);
console.log("Consumer B: " + lab.consumerBaseUrl);
console.log("Open Consumer B and run the handshake.");
console.log("Rotate: POST " + lab.issuerBaseUrl + "/lab/rotate");
console.log("Lapse:  POST " + lab.issuerBaseUrl + "/lab/lapse");

async function stop(): Promise<void> {
  await lab.close();
  process.exit(0);
}

process.once("SIGINT", () => {
  void stop();
});
process.once("SIGTERM", () => {
  void stop();
});
