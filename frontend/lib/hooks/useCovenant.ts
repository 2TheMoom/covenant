"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import Covenant from "../contracts/Covenant";
import { getContractAddress, getStudioUrl } from "../genlayer/client";
import { useWallet } from "../genlayer/wallet";
import { success, error, configError } from "../utils/toast";
import type { Campaign, Milestone } from "../contracts/types";

export function useCovenantContract(): Covenant | null {
  const { address } = useWallet();
  const contractAddress = getContractAddress();
  const rpcUrl = getStudioUrl();

  const contract = useMemo(() => {
    if (!contractAddress) {
      configError(
        "Setup Required",
        "Contract address not configured. Please set NEXT_PUBLIC_CONTRACT_ADDRESS in your .env file.",
        { label: "Setup Guide", onClick: () => window.open("/docs/setup", "_blank") }
      );
      return null;
    }
    return new Covenant(contractAddress, address, rpcUrl);
  }, [contractAddress, address, rpcUrl]);

  return contract;
}

export function useCampaign(campaignId: string) {
  const contract = useCovenantContract();

  return useQuery<Campaign | null, Error>({
    queryKey: ["campaign", campaignId],
    queryFn: () => (contract ? contract.getCampaign(campaignId) : Promise.resolve(null)),
    refetchOnWindowFocus: true,
    staleTime: 2000,
    enabled: !!contract && !!campaignId,
  });
}

export function useAllCampaignIds() {
  const contract = useCovenantContract();

  return useQuery<string[], Error>({
    queryKey: ["campaignIds"],
    queryFn: () => (contract ? contract.getAllCampaignIds() : Promise.resolve([])),
    refetchOnWindowFocus: true,
    staleTime: 2000,
    enabled: !!contract,
  });
}

export function useCampaignList() {
  const contract = useCovenantContract();
  const idsQuery = useAllCampaignIds();

  const listQuery = useQuery<Array<{ id: string; campaign: Campaign }>, Error>({
    queryKey: ["campaignList", idsQuery.data],
    queryFn: async () => {
      if (!contract || !idsQuery.data) return [];
      const results = await Promise.all(
        idsQuery.data.map(async (id) => ({ id, campaign: await contract.getCampaign(id) }))
      );
      return results.filter((r): r is { id: string; campaign: Campaign } => r.campaign !== null);
    },
    enabled: !!contract && !!idsQuery.data,
    staleTime: 2000,
  });

  return { ...listQuery, isLoading: idsQuery.isLoading || listQuery.isLoading };
}

export function useCampaignMilestoneIds(campaignId: string) {
  const contract = useCovenantContract();

  return useQuery<string[], Error>({
    queryKey: ["campaignMilestoneIds", campaignId],
    queryFn: () => (contract ? contract.getCampaignMilestoneIds(campaignId) : Promise.resolve([])),
    refetchOnWindowFocus: true,
    staleTime: 2000,
    enabled: !!contract && !!campaignId,
  });
}

export function useMilestone(milestoneId: string) {
  const contract = useCovenantContract();

  return useQuery<Milestone | null, Error>({
    queryKey: ["milestone", milestoneId],
    queryFn: () => (contract ? contract.getMilestone(milestoneId) : Promise.resolve(null)),
    refetchOnWindowFocus: true,
    staleTime: 2000,
    enabled: !!contract && !!milestoneId,
  });
}

export function useCampaignMilestones(campaignId: string) {
  const contract = useCovenantContract();
  const idsQuery = useCampaignMilestoneIds(campaignId);

  const listQuery = useQuery<Array<{ id: string; milestone: Milestone }>, Error>({
    queryKey: ["campaignMilestones", campaignId, idsQuery.data],
    queryFn: async () => {
      if (!contract || !idsQuery.data) return [];
      const results = await Promise.all(
        idsQuery.data.map(async (id) => ({ id, milestone: await contract.getMilestone(id) }))
      );
      return results.filter((r): r is { id: string; milestone: Milestone } => r.milestone !== null);
    },
    enabled: !!contract && !!idsQuery.data,
    staleTime: 2000,
  });

  return { ...listQuery, isLoading: idsQuery.isLoading || listQuery.isLoading };
}

export function useDonation(campaignId: string, wallet: string | null) {
  const contract = useCovenantContract();

  return useQuery<string, Error>({
    queryKey: ["donation", campaignId, wallet],
    queryFn: () => (contract && wallet ? contract.getDonation(campaignId, wallet) : Promise.resolve("0")),
    staleTime: 2000,
    enabled: !!contract && !!campaignId && !!wallet,
  });
}

export function useDonors(campaignId: string) {
  const contract = useCovenantContract();

  return useQuery<string[], Error>({
    queryKey: ["donors", campaignId],
    queryFn: () => (contract ? contract.getDonors(campaignId) : Promise.resolve([])),
    staleTime: 2000,
    enabled: !!contract && !!campaignId,
  });
}

export function useHasReclaimed(campaignId: string, wallet: string | null) {
  const contract = useCovenantContract();

  return useQuery<boolean, Error>({
    queryKey: ["hasReclaimed", campaignId, wallet],
    queryFn: () => (contract && wallet ? contract.hasReclaimed(campaignId, wallet) : Promise.resolve(false)),
    staleTime: 2000,
    enabled: !!contract && !!campaignId && !!wallet,
  });
}

export function useCampaignLeftover(campaignId: string) {
  const contract = useCovenantContract();

  return useQuery<string, Error>({
    queryKey: ["campaignLeftover", campaignId],
    queryFn: () => (contract ? contract.getCampaignLeftover(campaignId) : Promise.resolve("0")),
    staleTime: 2000,
    enabled: !!contract && !!campaignId,
  });
}

export function useHasReclaimedLeftover(campaignId: string, wallet: string | null) {
  const contract = useCovenantContract();

  return useQuery<boolean, Error>({
    queryKey: ["hasReclaimedLeftover", campaignId, wallet],
    queryFn: () => (contract && wallet ? contract.hasReclaimedLeftover(campaignId, wallet) : Promise.resolve(false)),
    staleTime: 2000,
    enabled: !!contract && !!campaignId && !!wallet,
  });
}

function useWriteAction<TArgs>(
  action: (contract: Covenant, args: TArgs, feePreset: any, onSubmitted: (h: string) => void) => Promise<string>,
  successMessage: { title: string; description: string },
  errorTitle: string,
  invalidate: (queryClient: ReturnType<typeof useQueryClient>, args: TArgs) => void
) {
  const contract = useCovenantContract();
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (args: TArgs) => {
      if (!contract) throw new Error("Contract not configured. Please set NEXT_PUBLIC_CONTRACT_ADDRESS in your .env file.");
      if (!address) throw new Error("Wallet not connected. Please connect your wallet first.");
      setIsPending(true);
      setPendingTxHash(null);
      return action(contract, args, undefined, setPendingTxHash);
    },
    onSuccess: (_data, args) => {
      invalidate(queryClient, args);
      setIsPending(false);
      success(successMessage.title, { description: successMessage.description });
    },
    onError: (err: any) => {
      console.error(errorTitle, err);
      setIsPending(false);
      error(errorTitle, { description: err?.message || "Please try again." });
    },
  });

  return {
    ...mutation,
    isPending,
    pendingTxHash,
    clearPendingTx: () => setPendingTxHash(null),
    run: mutation.mutate,
  };
}

export interface CreateCampaignArgs {
  id: string;
  title: string;
  description: string;
}

export function useCreateCampaign() {
  return useWriteAction<CreateCampaignArgs>(
    (c, a, fee, cb) => c.createCampaign(a.id, a.title, a.description, fee, cb),
    { title: "Campaign created", description: "Open for milestones and donations." },
    "Failed to create campaign",
    (qc) => {
      qc.invalidateQueries({ queryKey: ["campaignIds"] });
      qc.invalidateQueries({ queryKey: ["campaignList"] });
    }
  );
}

export interface AddMilestoneArgs {
  campaignId: string;
  milestoneId: string;
  description: string;
  targetAmountWei: bigint;
  checkType: string;
  checkParams: string;
}

export function useAddMilestone() {
  return useWriteAction<AddMilestoneArgs>(
    (c, a, fee, cb) => c.addMilestone(a.campaignId, a.milestoneId, a.description, a.targetAmountWei, a.checkType, a.checkParams, fee, cb),
    { title: "Milestone added", description: "Locked in before any donation arrives." },
    "Failed to add milestone",
    (qc, a) => {
      qc.invalidateQueries({ queryKey: ["campaignMilestoneIds", a.campaignId] });
      qc.invalidateQueries({ queryKey: ["campaignMilestones", a.campaignId] });
    }
  );
}

export interface DonateArgs {
  campaignId: string;
  amountWei: bigint;
}

export function useDonate() {
  return useWriteAction<DonateArgs>(
    (c, a, fee, cb) => c.donate(a.campaignId, a.amountWei, fee, cb),
    { title: "Donated", description: "Pooled on-chain, released only per verified milestone." },
    "Failed to donate",
    (qc, a) => {
      qc.invalidateQueries({ queryKey: ["campaign", a.campaignId] });
      qc.invalidateQueries({ queryKey: ["campaignList"] });
      qc.invalidateQueries({ queryKey: ["donation", a.campaignId] });
      qc.invalidateQueries({ queryKey: ["donors", a.campaignId] });
    }
  );
}

export function useVerifyMilestone() {
  return useWriteAction<{ id: string; campaignId: string }>(
    (c, a, fee, cb) => c.verifyMilestone(a.id, fee, cb),
    { title: "Verified", description: "A validator independently confirmed the evidence." },
    "Verification failed",
    (qc, a) => {
      qc.invalidateQueries({ queryKey: ["milestone", a.id] });
      qc.invalidateQueries({ queryKey: ["campaignMilestones", a.campaignId] });
    }
  );
}

export function useChallengeMilestone() {
  return useWriteAction<{ id: string; campaignId: string; reason: string }>(
    (c, a, fee, cb) => c.challengeMilestone(a.id, a.reason, fee, cb),
    { title: "Challenge filed", description: "Escalated for reasoned review." },
    "Failed to challenge",
    (qc, a) => {
      qc.invalidateQueries({ queryKey: ["milestone", a.id] });
      qc.invalidateQueries({ queryKey: ["campaignMilestones", a.campaignId] });
    }
  );
}

export function useResolveChallenge() {
  return useWriteAction<{ id: string; campaignId: string }>(
    (c, a, fee, cb) => c.resolveChallenge(a.id, fee, cb),
    { title: "Challenge resolved", description: "A validator reached a verdict." },
    "Failed to resolve challenge",
    (qc, a) => {
      qc.invalidateQueries({ queryKey: ["milestone", a.id] });
      qc.invalidateQueries({ queryKey: ["campaignMilestones", a.campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign", a.campaignId] });
    }
  );
}

export function useClaimMilestonePayout() {
  return useWriteAction<{ id: string; campaignId: string }>(
    (c, a, fee, cb) => c.claimMilestonePayout(a.id, fee, cb),
    { title: "Payout released", description: "Sent to the campaign recipient." },
    "Failed to release payout",
    (qc, a) => {
      qc.invalidateQueries({ queryKey: ["milestone", a.id] });
      qc.invalidateQueries({ queryKey: ["campaignMilestones", a.campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign", a.campaignId] });
      qc.invalidateQueries({ queryKey: ["campaignList"] });
    }
  );
}

export function useReclaimDonation() {
  return useWriteAction<{ campaignId: string }>(
    (c, a, fee, cb) => c.reclaimDonation(a.campaignId, fee, cb),
    { title: "Reclaimed", description: "Your donation was refunded." },
    "Failed to reclaim",
    (qc, a) => {
      qc.invalidateQueries({ queryKey: ["campaign", a.campaignId] });
      qc.invalidateQueries({ queryKey: ["donation", a.campaignId] });
      qc.invalidateQueries({ queryKey: ["hasReclaimed", a.campaignId] });
      qc.invalidateQueries({ queryKey: ["campaignList"] });
    }
  );
}

export function useResolveStaleDispute() {
  return useWriteAction<{ id: string; campaignId: string }>(
    (c, a, fee, cb) => c.resolveStaleDispute(a.id, fee, cb),
    { title: "Dispute settled", description: "Settled at the pre-dispute outcome after the stale window." },
    "Failed to settle dispute",
    (qc, a) => {
      qc.invalidateQueries({ queryKey: ["milestone", a.id] });
      qc.invalidateQueries({ queryKey: ["campaignMilestones", a.campaignId] });
    }
  );
}

export function useRetryMilestonePayout() {
  return useWriteAction<{ id: string; campaignId: string }>(
    (c, a, fee, cb) => c.retryMilestonePayout(a.id, fee, cb),
    { title: "Retry submitted", description: "Retried your own pending payout." },
    "Retry failed",
    (qc, a) => {
      qc.invalidateQueries({ queryKey: ["milestone", a.id] });
      qc.invalidateQueries({ queryKey: ["campaignMilestones", a.campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign", a.campaignId] });
    }
  );
}

export function useRetryDonationReclaim() {
  return useWriteAction<{ campaignId: string }>(
    (c, a, fee, cb) => c.retryDonationReclaim(a.campaignId, fee, cb),
    { title: "Retry submitted", description: "Retried your own pending refund." },
    "Retry failed",
    (qc, a) => {
      qc.invalidateQueries({ queryKey: ["campaign", a.campaignId] });
      qc.invalidateQueries({ queryKey: ["donation", a.campaignId] });
      qc.invalidateQueries({ queryKey: ["hasReclaimed", a.campaignId] });
    }
  );
}

export function useReclaimLeftover() {
  return useWriteAction<{ campaignId: string }>(
    (c, a, fee, cb) => c.reclaimLeftover(a.campaignId, fee, cb),
    { title: "Leftover reclaimed", description: "Your share of the unreleased funds was sent to your wallet." },
    "Failed to reclaim leftover",
    (qc, a) => {
      qc.invalidateQueries({ queryKey: ["campaign", a.campaignId] });
      qc.invalidateQueries({ queryKey: ["donation", a.campaignId] });
      qc.invalidateQueries({ queryKey: ["campaignLeftover", a.campaignId] });
      qc.invalidateQueries({ queryKey: ["hasReclaimedLeftover", a.campaignId] });
    }
  );
}

export function useRetryLeftoverReclaim() {
  return useWriteAction<{ campaignId: string }>(
    (c, a, fee, cb) => c.retryLeftoverReclaim(a.campaignId, fee, cb),
    { title: "Retry submitted", description: "Retried your own pending leftover share." },
    "Retry failed",
    (qc, a) => {
      qc.invalidateQueries({ queryKey: ["campaign", a.campaignId] });
      qc.invalidateQueries({ queryKey: ["donation", a.campaignId] });
    }
  );
}
