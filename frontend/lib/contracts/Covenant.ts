import { createClient } from "genlayer-js";
import { getGenLayerChain } from "../genlayer/chains";
import type { Campaign, Milestone } from "./types";
import {
  estimateWriteFeePreset,
  feePresetToTransactionFees,
  type FeePresetEstimate,
  type FeePresetLevel,
} from "../genlayer/fees";

/**
 * genlayer-js decodes Python dicts (and dataclasses) as JS Map instances,
 * keyed by field name. This flattens one level of the Map into a plain
 * object.
 */
function toPlainObject(raw: any): Record<string, any> {
  const entries = raw instanceof Map ? Array.from(raw.entries()) : Object.entries(raw ?? {});
  const obj: Record<string, any> = {};
  for (const [key, value] of entries) {
    obj[key] = value;
  }
  return obj;
}

function decodeCampaign(raw: any): Campaign {
  const obj = toPlainObject(raw);
  return {
    recipient: String(obj.recipient ?? ""),
    title: String(obj.title ?? ""),
    description: String(obj.description ?? ""),
    total_raised: String(obj.total_raised ?? "0"),
    total_released: String(obj.total_released ?? "0"),
    status: String(obj.status ?? "fundraising") as Campaign["status"],
    created_at: String(obj.created_at ?? "0"),
  };
}

function decodeMilestone(raw: any): Milestone {
  const obj = toPlainObject(raw);
  return {
    campaign_id: String(obj.campaign_id ?? ""),
    description: String(obj.description ?? ""),
    target_amount: String(obj.target_amount ?? "0"),
    check_type: String(obj.check_type ?? "deployment_live") as Milestone["check_type"],
    check_params: String(obj.check_params ?? "{}"),
    status: String(obj.status ?? "pending") as Milestone["status"],
    verified_at: String(obj.verified_at ?? "0"),
    challenge_reason: String(obj.challenge_reason ?? ""),
    challenger: String(obj.challenger ?? ""),
    resolution_note: String(obj.resolution_note ?? ""),
    paid_amount: String(obj.paid_amount ?? "0"),
    challenge_deadline: String(obj.challenge_deadline ?? "0"),
  };
}

/**
 * Covenant contract class - a verified-impact grants platform. donate is
 * the only payable write (it pools funds into a campaign); every other
 * write only defines a milestone, moves it between states, or releases an
 * already-pooled amount.
 */
class Covenant {
  private contractAddress: `0x${string}`;
  private client: any;
  private rpcUrl?: string;

  constructor(contractAddress: string, address?: string | null, rpcUrl?: string) {
    this.contractAddress = contractAddress as `0x${string}`;
    this.rpcUrl = rpcUrl;

    const config: any = { chain: getGenLayerChain() };
    if (address) config.account = address as `0x${string}`;
    if (rpcUrl) config.endpoint = rpcUrl;

    this.client = createClient(config);
  }

  updateAccount(address: string): void {
    const config: any = { chain: getGenLayerChain(), account: address as `0x${string}` };
    if (this.rpcUrl) config.endpoint = this.rpcUrl;
    this.client = createClient(config);
  }

  private async estimateFees(
    functionName: string,
    args: unknown[],
    level: FeePresetLevel = "standard"
  ): Promise<FeePresetEstimate | undefined> {
    return estimateWriteFeePreset(this.client, { address: this.contractAddress, functionName, args }, level);
  }

  async getCampaign(campaignId: string): Promise<Campaign | null> {
    try {
      const result = await this.client.readContract({
        address: this.contractAddress, functionName: "get_campaign", args: [campaignId],
      });
      return decodeCampaign(result);
    } catch {
      return null;
    }
  }

  async getMilestone(milestoneId: string): Promise<Milestone | null> {
    try {
      const result = await this.client.readContract({
        address: this.contractAddress, functionName: "get_milestone", args: [milestoneId],
      });
      return decodeMilestone(result);
    } catch {
      return null;
    }
  }

  async getAllCampaignIds(): Promise<string[]> {
    const result: any = await this.client.readContract({
      address: this.contractAddress, functionName: "get_all_campaign_ids", args: [],
    });
    return Array.isArray(result) ? result.map(String) : [];
  }

  async getCampaignMilestoneIds(campaignId: string): Promise<string[]> {
    const result: any = await this.client.readContract({
      address: this.contractAddress, functionName: "get_campaign_milestone_ids", args: [campaignId],
    });
    return Array.isArray(result) ? result.map(String) : [];
  }

  async getDonation(campaignId: string, wallet: string): Promise<string> {
    const result: any = await this.client.readContract({
      address: this.contractAddress, functionName: "get_donation", args: [campaignId, wallet],
    });
    return String(result ?? "0");
  }

  async getDonors(campaignId: string): Promise<string[]> {
    const result: any = await this.client.readContract({
      address: this.contractAddress, functionName: "get_donors", args: [campaignId],
    });
    return Array.isArray(result) ? result.map(String) : [];
  }

  async hasReclaimed(campaignId: string, wallet: string): Promise<boolean> {
    const result: any = await this.client.readContract({
      address: this.contractAddress, functionName: "has_reclaimed", args: [campaignId, wallet],
    });
    return Boolean(result);
  }

  async getCampaignLeftover(campaignId: string): Promise<string> {
    const result: any = await this.client.readContract({
      address: this.contractAddress, functionName: "get_campaign_leftover", args: [campaignId],
    });
    return String(result ?? "0");
  }

  async hasReclaimedLeftover(campaignId: string, wallet: string): Promise<boolean> {
    const result: any = await this.client.readContract({
      address: this.contractAddress, functionName: "has_reclaimed_leftover", args: [campaignId, wallet],
    });
    return Boolean(result);
  }

  /** `key` is the raw internal retry key: a milestone id directly, or
   * `reclaimed_<campaignId>_<wallet>` / `leftover_<campaignId>_<wallet>`
   * (lowercased) for a donation reclaim or leftover reclaim. */
  async getPendingPayout(key: string): Promise<string> {
    const result: any = await this.client.readContract({
      address: this.contractAddress, functionName: "get_pending_payout", args: [key],
    });
    return String(result ?? "0");
  }

  private async submitWrite(
    functionName: string,
    args: unknown[],
    feePreset?: FeePresetEstimate,
    onSubmitted?: (txHash: string) => void,
    value: bigint = BigInt(0)
  ): Promise<string> {
    const fees = feePresetToTransactionFees(feePreset);
    let txHash: string;
    try {
      txHash = await this.client.writeContract({
        address: this.contractAddress,
        functionName,
        args,
        value,
        ...(fees ? { fees } : {}),
      });
    } catch (error) {
      console.error(`Error calling ${functionName}:`, error);
      throw new Error(`Failed to submit the ${functionName} transaction. Please try again.`);
    }

    onSubmitted?.(txHash);

    try {
      await this.client.waitForTransactionReceipt({ hash: txHash, status: "ACCEPTED" as any, retries: 40, interval: 5000 });
      return txHash;
    } catch (error) {
      console.error(`Error confirming ${functionName} transaction:`, error);
      throw new Error(
        `Transaction ${txHash} was submitted but confirmation timed out. It may still complete - check the explorer.`
      );
    }
  }

  async estimateCreateCampaignFees(campaignId: string, title: string, description: string, level: FeePresetLevel = "standard") {
    return this.estimateFees("create_campaign", [campaignId, title, description], level);
  }

  async createCampaign(campaignId: string, title: string, description: string, feePreset?: FeePresetEstimate, onSubmitted?: (txHash: string) => void) {
    return this.submitWrite("create_campaign", [campaignId, title, description], feePreset, onSubmitted);
  }

  async estimateAddMilestoneFees(campaignId: string, milestoneId: string, description: string, targetAmountWei: bigint, checkType: string, checkParams: string, level: FeePresetLevel = "standard") {
    return this.estimateFees("add_milestone", [campaignId, milestoneId, description, targetAmountWei, checkType, checkParams], level);
  }

  async addMilestone(
    campaignId: string, milestoneId: string, description: string, targetAmountWei: bigint, checkType: string, checkParams: string,
    feePreset?: FeePresetEstimate, onSubmitted?: (txHash: string) => void
  ) {
    return this.submitWrite("add_milestone", [campaignId, milestoneId, description, targetAmountWei, checkType, checkParams], feePreset, onSubmitted);
  }

  async estimateDonateFees(campaignId: string, level: FeePresetLevel = "standard") {
    return this.estimateFees("donate", [campaignId], level);
  }

  async donate(campaignId: string, amountWei: bigint, feePreset?: FeePresetEstimate, onSubmitted?: (txHash: string) => void) {
    return this.submitWrite("donate", [campaignId], feePreset, onSubmitted, amountWei);
  }

  async estimateVerifyMilestoneFees(milestoneId: string, level: FeePresetLevel = "standard") {
    return this.estimateFees("verify_milestone", [milestoneId], level);
  }

  async verifyMilestone(milestoneId: string, feePreset?: FeePresetEstimate, onSubmitted?: (txHash: string) => void) {
    return this.submitWrite("verify_milestone", [milestoneId], feePreset, onSubmitted);
  }

  async estimateChallengeMilestoneFees(milestoneId: string, reason: string, level: FeePresetLevel = "standard") {
    return this.estimateFees("challenge_milestone", [milestoneId, reason], level);
  }

  async challengeMilestone(milestoneId: string, reason: string, feePreset?: FeePresetEstimate, onSubmitted?: (txHash: string) => void) {
    return this.submitWrite("challenge_milestone", [milestoneId, reason], feePreset, onSubmitted);
  }

  async estimateResolveChallengeFees(milestoneId: string, level: FeePresetLevel = "standard") {
    return this.estimateFees("resolve_challenge", [milestoneId], level);
  }

  async resolveChallenge(milestoneId: string, feePreset?: FeePresetEstimate, onSubmitted?: (txHash: string) => void) {
    return this.submitWrite("resolve_challenge", [milestoneId], feePreset, onSubmitted);
  }

  async estimateClaimMilestonePayoutFees(milestoneId: string, level: FeePresetLevel = "standard") {
    return this.estimateFees("claim_milestone_payout", [milestoneId], level);
  }

  async claimMilestonePayout(milestoneId: string, feePreset?: FeePresetEstimate, onSubmitted?: (txHash: string) => void) {
    return this.submitWrite("claim_milestone_payout", [milestoneId], feePreset, onSubmitted);
  }

  async estimateReclaimDonationFees(campaignId: string, level: FeePresetLevel = "standard") {
    return this.estimateFees("reclaim_donation", [campaignId], level);
  }

  async reclaimDonation(campaignId: string, feePreset?: FeePresetEstimate, onSubmitted?: (txHash: string) => void) {
    return this.submitWrite("reclaim_donation", [campaignId], feePreset, onSubmitted);
  }

  async estimateResolveStaleDisputeFees(milestoneId: string, level: FeePresetLevel = "standard") {
    return this.estimateFees("resolve_stale_dispute", [milestoneId], level);
  }

  async resolveStaleDispute(milestoneId: string, feePreset?: FeePresetEstimate, onSubmitted?: (txHash: string) => void) {
    return this.submitWrite("resolve_stale_dispute", [milestoneId], feePreset, onSubmitted);
  }

  async estimateRetryMilestonePayoutFees(milestoneId: string, level: FeePresetLevel = "standard") {
    return this.estimateFees("retry_milestone_payout", [milestoneId], level);
  }

  async retryMilestonePayout(milestoneId: string, feePreset?: FeePresetEstimate, onSubmitted?: (txHash: string) => void) {
    return this.submitWrite("retry_milestone_payout", [milestoneId], feePreset, onSubmitted);
  }

  async estimateRetryDonationReclaimFees(campaignId: string, level: FeePresetLevel = "standard") {
    return this.estimateFees("retry_donation_reclaim", [campaignId], level);
  }

  async retryDonationReclaim(campaignId: string, feePreset?: FeePresetEstimate, onSubmitted?: (txHash: string) => void) {
    return this.submitWrite("retry_donation_reclaim", [campaignId], feePreset, onSubmitted);
  }

  async estimateReclaimLeftoverFees(campaignId: string, level: FeePresetLevel = "standard") {
    return this.estimateFees("reclaim_leftover", [campaignId], level);
  }

  async reclaimLeftover(campaignId: string, feePreset?: FeePresetEstimate, onSubmitted?: (txHash: string) => void) {
    return this.submitWrite("reclaim_leftover", [campaignId], feePreset, onSubmitted);
  }

  async estimateRetryLeftoverReclaimFees(campaignId: string, level: FeePresetLevel = "standard") {
    return this.estimateFees("retry_leftover_reclaim", [campaignId], level);
  }

  async retryLeftoverReclaim(campaignId: string, feePreset?: FeePresetEstimate, onSubmitted?: (txHash: string) => void) {
    return this.submitWrite("retry_leftover_reclaim", [campaignId], feePreset, onSubmitted);
  }
}

export default Covenant;
