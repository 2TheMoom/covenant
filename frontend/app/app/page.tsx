"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { LogoMark } from "@/components/Logo";
import { useWallet } from "@/lib/genlayer/wallet";
import {
  useCampaign,
  useCampaignList,
  useCampaignMilestones,
  useMilestone,
  useCreateCampaign,
  useAddMilestone,
  useDonate,
  useVerifyMilestone,
  useChallengeMilestone,
  useResolveChallenge,
  useClaimMilestonePayout,
  useReclaimDonation,
  useDonation,
  useHasReclaimed,
} from "@/lib/hooks/useCovenant";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Campaign, Milestone, CheckType } from "@/lib/contracts/types";

const CHALLENGE_WINDOW_SECONDS = 600;
const RECOVERY_TIMEOUT_SECONDS = 86400;

function shortAddr(hex: string): string {
  if (!hex) return "—";
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return `0x${clean.slice(0, 4)}…${clean.slice(-4)}`;
}

function sameAddr(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

function formatGen(wei: string): string {
  const n = Number(wei) / 1e18;
  if (!Number.isFinite(n)) return "0.000";
  return n.toFixed(3);
}

function genToWei(input: string): bigint {
  const trimmed = input.trim();
  if (!trimmed) return BigInt(0);
  const [intPartRaw, fracPartRaw = ""] = trimmed.split(".");
  const intPart = intPartRaw || "0";
  const fracPart = (fracPartRaw + "0".repeat(18)).slice(0, 18);
  if (!/^\d+$/.test(intPart) || !/^\d*$/.test(fracPart)) return BigInt(0);
  return BigInt(intPart) * BigInt(10) ** BigInt(18) + BigInt(fracPart || "0");
}

function formatDate(ts: string): string {
  const n = Number(ts);
  if (!n) return "—";
  return new Date(n * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function useNow(tickMs = 1000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return now;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function campaignStatusPillClass(status: Campaign["status"]): string {
  return `status-pill ${status}`;
}

function milestoneStatusPillClass(status: Milestone["status"]): string {
  return `status-pill ${status}`;
}

function milestoneStatusLabel(m: Milestone, now: number): string {
  switch (m.status) {
    case "pending": return "Pending verification";
    case "verified": {
      const closes = Number(m.challenge_deadline);
      return now < closes ? "Verified · Challenge window" : "Verified · Ready to pay out";
    }
    case "disputed": return "Disputed · Awaiting resolution";
    case "failed": return "Failed challenge";
    case "paid": return "Paid";
    default: return m.status;
  }
}

function checkTypeSummary(m: Milestone): string {
  try {
    const p = JSON.parse(m.check_params || "{}");
    if (m.check_type === "github_merged") return `GitHub PR merged · ${p.repo ?? "?"}#${p.pr_number ?? "?"}`;
    if (m.check_type === "deployment_live") return p.marker ? `Live with marker "${p.marker}"` : `Live at ${p.url ?? "?"}`;
    if (m.check_type === "threshold") return `${p.json_path ?? "?"} ${p.comparison_op ?? "?"} ${(Number(p.threshold_scaled ?? 0) / 1e8).toString()}`;
    return m.check_type;
  } catch {
    return m.check_type;
  }
}

// --------------------------------------------------------------------------
// dialogs
// --------------------------------------------------------------------------

function CreateCampaignDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const { address } = useWallet();
  const create = useCreateCampaign();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", title: "", description: "" });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = () => {
    if (!form.id || !form.title || !form.description) return;
    create.run(
      { id: form.id, title: form.title, description: form.description },
      { onSuccess: () => { onCreated(form.id); setOpen(false); setForm({ id: "", title: "", description: "" }); } } as any
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="btn-field solid" disabled={!address}>+ New campaign</button>
      </DialogTrigger>
      <DialogContent className="!rounded-2xl !bg-card !border-border-bright sm:!max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-head">New campaign</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3.5 mt-1">
          <div>
            <Label className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>Campaign ID</Label>
            <Input value={form.id} onChange={set("id")} placeholder="flood-sensors" className="mt-1 font-mono" />
          </div>
          <div>
            <Label className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>Title</Label>
            <Input value={form.title} onChange={set("title")} placeholder="Open Flood-Sensor Network" className="mt-1" />
          </div>
          <div>
            <Label className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>Description</Label>
            <textarea
              value={form.description} onChange={set("description")}
              placeholder="What this campaign funds, and why it matters."
              rows={3}
              className="mt-1 w-full px-3 py-2 text-sm bg-transparent border border-input rounded-lg outline-none focus-visible:border-ring"
              style={{ fontFamily: "var(--font-body)", color: "var(--foreground)" }}
            />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <button className="btn-field solid w-full" onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create campaign"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const CHECK_TYPE_LABELS: Record<CheckType, string> = {
  github_merged: "GitHub PR merged",
  deployment_live: "Deployment is live",
  threshold: "A live number crosses a threshold",
};

function AddMilestoneDialog({ campaignId }: { campaignId: string }) {
  const add = useAddMilestone();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [checkType, setCheckType] = useState<CheckType>("deployment_live");
  const [repo, setRepo] = useState("");
  const [prNumber, setPrNumber] = useState("");
  const [url, setUrl] = useState("");
  const [marker, setMarker] = useState("");
  const [jsonPath, setJsonPath] = useState("");
  const [comparisonOp, setComparisonOp] = useState("ge");
  const [threshold, setThreshold] = useState("");

  const buildCheckParams = (): string | null => {
    if (checkType === "github_merged") {
      const pr = parseInt(prNumber, 10);
      if (!repo.includes("/") || !Number.isFinite(pr) || pr <= 0) return null;
      return JSON.stringify({ repo, pr_number: pr });
    }
    if (checkType === "deployment_live") {
      if (!url.startsWith("https://")) return null;
      return JSON.stringify(marker ? { url, marker } : { url });
    }
    if (!url.startsWith("https://") || !jsonPath) return null;
    const thr = Number(threshold);
    if (!Number.isFinite(thr)) return null;
    const op = { ge: ">=", le: "<=", eq: "==", gt: ">", lt: "<" }[comparisonOp] ?? ">=";
    return JSON.stringify({ url, json_path: jsonPath, comparison_op: op, threshold_scaled: Math.round(thr * 1e8) });
  };

  const handleSubmit = () => {
    const milestoneId = `${campaignId}-m-${Date.now()}`;
    const checkParams = buildCheckParams();
    const amount = Number(targetAmount);
    if (!description || !checkParams || !Number.isFinite(amount) || amount <= 0) return;
    add.run(
      { campaignId, milestoneId, description, targetAmountWei: genToWei(targetAmount), checkType, checkParams },
      { onSuccess: () => { setOpen(false); setDescription(""); setTargetAmount(""); } } as any
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="btn-field ghost">+ Add milestone</button>
      </DialogTrigger>
      <DialogContent className="!rounded-2xl !bg-card !border-border-bright sm:!max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-head">New milestone</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3.5 mt-1 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <Label className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>What gets built</Label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Deploy the sensor relay"
              rows={2}
              className="mt-1 w-full px-3 py-2 text-sm bg-transparent border border-input rounded-lg outline-none focus-visible:border-ring"
              style={{ fontFamily: "var(--font-body)", color: "var(--foreground)" }}
            />
          </div>
          <div>
            <Label className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>Payout amount (GEN)</Label>
            <Input value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="1000" className="mt-1 font-mono" />
          </div>
          <div>
            <Label className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>How it&apos;s checked</Label>
            <select
              value={checkType}
              onChange={(e) => setCheckType(e.target.value as CheckType)}
              className="mt-1 w-full px-3 py-2 text-sm bg-transparent border border-input rounded-lg outline-none"
              style={{ fontFamily: "var(--font-body)", color: "var(--foreground)" }}
            >
              {(Object.keys(CHECK_TYPE_LABELS) as CheckType[]).map((ct) => (
                <option key={ct} value={ct} style={{ background: "var(--card)" }}>{CHECK_TYPE_LABELS[ct]}</option>
              ))}
            </select>
          </div>

          {checkType === "github_merged" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>Repo</Label>
                <Input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="acme/widgets" className="mt-1 font-mono" />
              </div>
              <div>
                <Label className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>PR number</Label>
                <Input value={prNumber} onChange={(e) => setPrNumber(e.target.value)} placeholder="42" className="mt-1 font-mono" />
              </div>
            </div>
          )}
          {checkType === "deployment_live" && (
            <>
              <div>
                <Label className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>URL</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="mt-1 font-mono" />
              </div>
              <div>
                <Label className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>Marker text (optional)</Label>
                <Input value={marker} onChange={(e) => setMarker(e.target.value)} placeholder="text that must appear once live" className="mt-1 font-mono" />
              </div>
            </>
          )}
          {checkType === "threshold" && (
            <>
              <div>
                <Label className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>URL (returns JSON)</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="mt-1 font-mono" />
              </div>
              <div>
                <Label className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>JSON path</Label>
                <Input value={jsonPath} onChange={(e) => setJsonPath(e.target.value)} placeholder="data.count" className="mt-1 font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>Comparison</Label>
                  <select
                    value={comparisonOp}
                    onChange={(e) => setComparisonOp(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-transparent border border-input rounded-lg outline-none font-mono"
                    style={{ color: "var(--foreground)" }}
                  >
                    <option value="ge" style={{ background: "var(--card)" }}>&ge;</option>
                    <option value="le" style={{ background: "var(--card)" }}>&le;</option>
                    <option value="eq" style={{ background: "var(--card)" }}>==</option>
                    <option value="gt" style={{ background: "var(--card)" }}>&gt;</option>
                    <option value="lt" style={{ background: "var(--card)" }}>&lt;</option>
                  </select>
                </div>
                <div>
                  <Label className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>Threshold</Label>
                  <Input value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="5" className="mt-1 font-mono" />
                </div>
              </div>
            </>
          )}
        </div>
        <DialogFooter className="mt-4">
          <button className="btn-field solid w-full" onClick={handleSubmit} disabled={add.isPending}>
            {add.isPending ? "Adding…" : "Add milestone"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DonateDialog({ campaignId }: { campaignId: string }) {
  const { address } = useWallet();
  const donate = useDonate();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="btn-field solid" disabled={!address}>Donate</button>
      </DialogTrigger>
      <DialogContent className="!rounded-2xl !bg-card !border-border-bright sm:!max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-head">Fund this campaign</DialogTitle>
        </DialogHeader>
        <div className="mt-1">
          <Label className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>Amount (GEN)</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10" className="mt-1 font-mono" />
        </div>
        <DialogFooter className="mt-4">
          <button
            className="btn-field solid w-full"
            disabled={!amount || donate.isPending}
            onClick={() => donate.run({ campaignId, amountWei: genToWei(amount) }, { onSuccess: () => { setOpen(false); setAmount(""); } } as any)}
          >
            {donate.isPending ? "Donating…" : "Donate"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChallengeDialog({ milestoneId, campaignId }: { milestoneId: string; campaignId: string }) {
  const challenge = useChallengeMilestone();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="btn-field danger">Challenge</button>
      </DialogTrigger>
      <DialogContent className="!rounded-2xl !bg-card !border-border-bright sm:!max-w-md">
        <DialogHeader>
          <DialogTitle className="font-head">Challenge this verification</DialogTitle>
        </DialogHeader>
        <div className="mt-1">
          <Label className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>Why doesn&apos;t this satisfy the milestone?</Label>
          <textarea
            value={reason} onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="mt-1 w-full px-3 py-2 text-sm bg-transparent border border-input rounded-lg outline-none focus-visible:border-ring"
            style={{ fontFamily: "var(--font-body)", color: "var(--foreground)" }}
          />
        </div>
        <DialogFooter className="mt-4">
          <button
            className="btn-field danger w-full"
            disabled={!reason || challenge.isPending}
            onClick={() => challenge.run({ id: milestoneId, campaignId, reason }, { onSuccess: () => { setOpen(false); setReason(""); } } as any)}
          >
            {challenge.isPending ? "Filing…" : "File challenge"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------
// milestone row
// --------------------------------------------------------------------------

function MilestoneRow({ id, campaignId, isRecipient }: { id: string; campaignId: string; isRecipient: boolean }) {
  const { data: m } = useMilestone(id);
  const now = useNow();
  const verify = useVerifyMilestone();
  const resolve = useResolveChallenge();
  const claim = useClaimMilestonePayout();

  if (!m) return null;

  const challengeOpen = m.status === "verified" && now < Number(m.challenge_deadline);
  const canClaim = m.status === "verified" && !challengeOpen;

  return (
    <div className="rounded-xl p-4.5 flex flex-col gap-3" style={{ background: "var(--background)", border: "1px solid var(--border)", padding: 18 }}>
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <div className="text-[14.5px]" style={{ fontFamily: "var(--font-body)" }}>{m.description}</div>
          <div className="font-mono text-[11px] mt-1" style={{ color: "var(--ink-faint)" }}>{checkTypeSummary(m)}</div>
        </div>
        <span className={milestoneStatusPillClass(m.status)}>
          <span className="dot" /> {milestoneStatusLabel(m, now)}
        </span>
      </div>

      <div className="flex justify-between items-center font-mono text-[12px]" style={{ color: "var(--sage-bright)" }}>
        <span>{formatGen(m.target_amount)} GEN</span>
        {challengeOpen && <span style={{ color: "var(--amber-bright)" }}>Challenge closes in {formatCountdown(Number(m.challenge_deadline) - now)}</span>}
      </div>

      {(m.challenge_reason || m.resolution_note) && (
        <div className="field-note text-[13px]">
          {m.challenge_reason && <div><span style={{ color: "var(--rust)" }}>Challenge:</span> {m.challenge_reason}</div>}
          {m.resolution_note && <div className="mt-1.5"><span style={{ color: "var(--sage)" }}>Resolution:</span> {m.resolution_note}</div>}
        </div>
      )}

      <div className="flex gap-2.5 flex-wrap">
        {m.status === "pending" && (
          <button className="btn-field solid" disabled={verify.isPending} onClick={() => verify.run({ id, campaignId })}>
            {verify.isPending ? "Verifying…" : "Verify now"}
          </button>
        )}
        {challengeOpen && <ChallengeDialog milestoneId={id} campaignId={campaignId} />}
        {canClaim && isRecipient && (
          <button className="btn-field solid" disabled={claim.isPending} onClick={() => claim.run({ id, campaignId })}>
            {claim.isPending ? "Releasing…" : "Release payout"}
          </button>
        )}
        {m.status === "disputed" && (
          <button className="btn-field danger" disabled={resolve.isPending} onClick={() => resolve.run({ id, campaignId })}>
            {resolve.isPending ? "Resolving…" : "Resolve dispute"}
          </button>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// campaign detail
// --------------------------------------------------------------------------

function CampaignDetail({ id }: { id: string }) {
  const { data: c, isLoading } = useCampaign(id);
  const { data: milestoneRows } = useCampaignMilestones(id);
  const { address } = useWallet();
  const { data: myDonation } = useDonation(id, address ?? null);
  const { data: alreadyReclaimed } = useHasReclaimed(id, address ?? null);
  const reclaim = useReclaimDonation();
  const now = useNow(5000);

  if (isLoading) return <div className="p-8 text-center font-mono text-sm" style={{ color: "var(--ink-faint)" }}>Loading campaign…</div>;
  if (!c) return <div className="p-8 text-center font-mono text-sm" style={{ color: "var(--ink-faint)" }}>Campaign &quot;{id}&quot; not found.</div>;

  const isRecipient = sameAddr(address, c.recipient);
  const canAddMilestone = isRecipient && Number(c.total_raised) === 0;
  const hasProgress = (milestoneRows ?? []).some((r) => r.milestone.status !== "pending");
  const recoveryEligible = Number(c.created_at) > 0 && now >= Number(c.created_at) + RECOVERY_TIMEOUT_SECONDS;
  const canReclaim =
    c.status !== "completed" &&
    recoveryEligible &&
    !hasProgress &&
    Number(myDonation ?? "0") > 0 &&
    !alreadyReclaimed;

  return (
    <div className="rounded-2xl p-7 sm:p-8" style={{ background: "var(--card)", border: "1px solid var(--border-bright)" }}>
      <div className="flex justify-between items-start gap-5 flex-wrap mb-6">
        <div>
          <div className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>RECIPIENT {shortAddr(c.recipient)}</div>
          <h2 className="font-head mt-1 text-2xl max-w-[40ch]" style={{ textWrap: "balance" }}>{c.title}</h2>
          <p className="mt-2 text-sm max-w-[60ch]" style={{ color: "var(--muted-foreground)", lineHeight: 1.6 }}>{c.description}</p>
        </div>
        <span className={campaignStatusPillClass(c.status)}><span className="dot" /> {c.status}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr] gap-6 mb-6">
        <div className="flex flex-col gap-2.5">
          <div className="eyebrow">Funding</div>
          <div className="kv-row"><span className="k">TOTAL RAISED</span><span className="v amount">{formatGen(c.total_raised)} GEN</span></div>
          <div className="kv-row"><span className="k">TOTAL RELEASED</span><span className="v sage">{formatGen(c.total_released)} GEN</span></div>
          {address && <div className="kv-row"><span className="k">YOUR DONATION</span><span className="v">{formatGen(myDonation ?? "0")} GEN</span></div>}
        </div>
        <div className="flex flex-col gap-2.5 items-start sm:items-end justify-end">
          <div className="flex gap-2.5 flex-wrap">
            <DonateDialog campaignId={id} />
            {canAddMilestone && <AddMilestoneDialog campaignId={id} />}
            {canReclaim && (
              <button className="btn-field danger" disabled={reclaim.isPending} onClick={() => reclaim.run({ campaignId: id })}>
                {reclaim.isPending ? "Reclaiming…" : "Reclaim donation"}
              </button>
            )}
          </div>
          {!address && <span className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>Connect a wallet to act on this campaign.</span>}
        </div>
      </div>

      <div className="eyebrow mb-3">Milestones</div>
      {(milestoneRows ?? []).length === 0 ? (
        <div className="text-sm font-mono" style={{ color: "var(--ink-faint)" }}>
          No milestones yet. {isRecipient && "Add the first one before accepting any donation."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(milestoneRows ?? []).map(({ id: mid }) => (
            <MilestoneRow key={mid} id={mid} campaignId={id} isRecipient={isRecipient} />
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignLogRow({ id, campaign, active, onSelect }: { id: string; campaign: Campaign; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left grid gap-4 items-center py-4 px-3 rounded-xl"
      style={{ gridTemplateColumns: "1fr auto", background: active ? "var(--secondary)" : "transparent" }}
    >
      <div>
        <div className="text-[0.95rem]" style={{ fontFamily: "var(--font-body)" }}>{campaign.title}</div>
        <div className="font-mono text-[0.68rem] mt-0.5" style={{ color: "var(--ink-faint)" }}>{shortAddr(campaign.recipient)}</div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm" style={{ color: "var(--sage-bright)" }}>{formatGen(campaign.total_raised)} GEN</div>
        <div className="font-mono text-[0.65rem] uppercase tracking-wide mt-0.5" style={{ color: "var(--muted-foreground)" }}>{campaign.status}</div>
      </div>
    </button>
  );
}

function AppPageInner() {
  const { data: list, isLoading } = useCampaignList();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const fromQuery = searchParams.get("campaign");
    if (fromQuery) {
      setSelectedId(fromQuery);
    } else if (!selectedId && list && list.length > 0) {
      setSelectedId(list[list.length - 1].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, searchParams]);

  const select = (id: string) => {
    setSelectedId(id);
    router.replace(`/app?campaign=${encodeURIComponent(id)}`, { scroll: false });
  };

  const others = useMemo(() => (list ?? []).filter((r) => r.id !== selectedId).slice().reverse(), [list, selectedId]);

  return (
    <div className="max-w-[1040px] mx-auto px-5 pb-16 pt-7">
      <Navbar />

      <div className="flex justify-between items-end gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-head text-3xl" style={{ textWrap: "balance" }}>
            {selectedId ? "Campaign" : "No campaigns yet"}
          </h1>
          <div className="font-mono text-xs mt-1.5 max-w-[46ch]" style={{ color: "var(--ink-faint)" }}>
            Every milestone below is independently confirmed by a validator - not a status the recipient can just claim.
          </div>
        </div>
        <CreateCampaignDialog onCreated={select} />
      </div>

      <div className="mb-10">
        {isLoading && <div className="p-8 text-center font-mono text-sm" style={{ color: "var(--ink-faint)" }}>Loading…</div>}
        {!isLoading && !selectedId && (
          <div className="p-10 flex flex-col items-center gap-3 text-center rounded-2xl" style={{ background: "var(--card)", border: "1px dashed var(--border-bright)" }}>
            <LogoMark size="lg" />
            <div className="font-mono text-sm" style={{ color: "var(--ink-faint)" }}>
              No campaigns on this contract yet. Create the first one to see it here.
            </div>
          </div>
        )}
        {selectedId && <CampaignDetail id={selectedId} />}
      </div>

      {others.length > 0 && (
        <div>
          <div className="eyebrow mb-2">Other campaigns</div>
          <div className="flex flex-col gap-1">
            {others.map(({ id, campaign }) => (
              <CampaignLogRow key={id} id={id} campaign={campaign} active={id === selectedId} onSelect={() => select(id)} />
            ))}
          </div>
        </div>
      )}

      <footer className="flex justify-between flex-wrap gap-2 mt-14 pt-5 font-mono text-[0.68rem]" style={{ borderTop: "1px solid var(--border)", color: "var(--ink-faint)" }}>
        <div>Covenant &mdash; every milestone is independently confirmed by GenLayer validators, not taken on trust.</div>
      </footer>
    </div>
  );
}

export default function AppPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-mono text-sm" style={{ color: "var(--ink-faint)" }}>Loading…</div>}>
      <AppPageInner />
    </Suspense>
  );
}
