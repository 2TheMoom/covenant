// Proves Covenant's full lifecycle works end to end against the real
// deployed contract, using genlayer-js directly - the bare `genlayer
// write` CLI can't do this (--value isn't supported for payable calls,
// and its --args parser unconditionally coerces any JSON-shaped string
// to a dict/array with no escape hatch, which breaks add_milestone's
// check_params; see feedback-genlayer-cli-json-string-args).
//
// Runs: add_milestone (reusing the already-created e2e-test campaign) ->
// donate (real GEN, from a second account) -> verify_milestone
// (deterministic) -> wait for the challenge window to close ->
// claim_milestone_payout -> read the recipient's real on-chain balance
// before and after to confirm the payout actually delivered.
//
// Usage (PowerShell):
//   $env:PK = "0x<64-hex-char private key of the campaign creator/recipient>"
//   $env:PK2 = "0x<64-hex-char private key of the donor>"
//   node verify-full-lifecycle-live.mjs
//
// Get both via: genlayer account export --name <account-name>
// (exports a keystore file; decrypt it yourself, this script never sees
// your password)

import { createAccount, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const CONTRACT = "0xed2e2535DeC81F6A782569FE524537849d465745";
const CAMPAIGN_ID = "e2e-test-" + Date.now(); // fresh campaign, so PK is genuinely its recipient
const MILESTONE_ID = CAMPAIGN_ID + "-m-1";
const TARGET_AMOUNT = 1000000000000000n; // 0.001 GEN payout target
const DONATE_VALUE = 2000000000000000n; // 0.002 GEN - covers the milestone twice over
const CHECK_PARAMS = JSON.stringify({
  url: "https://raw.githubusercontent.com/genlayerlabs/genlayer-project-boilerplate/main/README.md",
  marker: "football bets",
});

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Set $env:${name} first`);
  return v.startsWith("0x") ? v : "0x" + v;
}

function safeStringify(obj) {
  return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() + "n" : v), 2);
}

async function waitAccepted(client, hash) {
  const receipt = await client.waitForTransactionReceipt({ hash, retries: 200 });
  console.log(`  status=${receipt.status_name} result=${receipt.resultName} exec=${receipt.txExecutionResultName}`);
  if (receipt.status_name !== "ACCEPTED" && receipt.status_name !== "FINALIZED") {
    throw new Error(`Transaction not accepted: ${safeStringify(receipt)}`);
  }
  if (receipt.txExecutionResultName && receipt.txExecutionResultName !== "FINISHED_WITH_RETURN") {
    throw new Error(`Call reverted: ${safeStringify(receipt)}`);
  }
  return receipt;
}

async function main() {
  const creatorAccount = createAccount(need("PK"));
  const donorAccount = createAccount(need("PK2"));

  const creatorClient = createClient({ chain: testnetBradbury, account: creatorAccount });
  const donorClient = createClient({ chain: testnetBradbury, account: donorAccount });

  const recipientAddress = creatorAccount.address;
  const balanceBefore = await creatorClient.getBalance({ address: recipientAddress });
  console.log(`Recipient (creator) balance before: ${balanceBefore} wei`);

  console.log("\n0. create_campaign (so PK is genuinely this campaign's recipient)...");
  let hash0 = await creatorClient.writeContract({
    address: CONTRACT,
    functionName: "create_campaign",
    args: [CAMPAIGN_ID, "E2E verification campaign", "A throwaway campaign to verify the full write/read/verify path end to end"],
  });
  await waitAccepted(creatorClient, hash0);

  console.log("\n1. add_milestone (real JSON check_params, via genlayer-js, not the CLI)...");
  let hash = await creatorClient.writeContract({
    address: CONTRACT,
    functionName: "add_milestone",
    args: [CAMPAIGN_ID, MILESTONE_ID, "Prove the full lifecycle end to end", TARGET_AMOUNT, "deployment_live", CHECK_PARAMS],
  });
  await waitAccepted(creatorClient, hash);

  console.log("\n2. donate (0.002 GEN from a second account)...");
  hash = await donorClient.writeContract({
    address: CONTRACT,
    functionName: "donate",
    args: [CAMPAIGN_ID],
    value: DONATE_VALUE,
  });
  await waitAccepted(donorClient, hash);

  console.log("\n3. verify_milestone (deterministic, no LLM)...");
  hash = await creatorClient.writeContract({
    address: CONTRACT,
    functionName: "verify_milestone",
    args: [MILESTONE_ID],
  });
  await waitAccepted(creatorClient, hash);

  const milestoneAfterVerify = await creatorClient.readContract({
    address: CONTRACT, functionName: "get_milestone", args: [MILESTONE_ID],
  });
  console.log("  milestone status:", milestoneAfterVerify.get ? milestoneAfterVerify.get("status") : milestoneAfterVerify.status);

  console.log("\nWaiting 11 minutes for the challenge window to close...");
  await new Promise((r) => setTimeout(r, 11 * 60 * 1000));

  console.log("\n4. claim_milestone_payout...");
  hash = await creatorClient.writeContract({
    address: CONTRACT,
    functionName: "claim_milestone_payout",
    args: [MILESTONE_ID],
  });
  await waitAccepted(creatorClient, hash);

  const balanceAfter = await creatorClient.getBalance({ address: recipientAddress });
  console.log(`\nRecipient balance after: ${balanceAfter} wei`);
  console.log(`Delta: ${balanceAfter - balanceBefore} wei`);
  console.log(
    balanceAfter > balanceBefore
      ? "\n✔ CONFIRMED: the full create->milestone->donate->verify->claim lifecycle delivered a real payout."
      : "\n✖ No positive delta - investigate (fees may have outweighed a very small payout; check the raw numbers above)."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
