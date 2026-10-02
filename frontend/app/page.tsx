"use client";

import Link from "next/link";
import { useMemo } from "react";
import { LogoFull, LogoMark } from "@/components/Logo";
import { useCampaignList } from "@/lib/hooks/useCovenant";
import type { Campaign } from "@/lib/contracts/types";

function formatGen(wei: string): string {
  const n = Number(wei) / 1e18;
  if (!Number.isFinite(n)) return "0";
  if (n === 0) return "0";
  return n < 1 ? n.toFixed(3) : Math.round(n).toLocaleString();
}

function campaignStatusTone(status: Campaign["status"]): string {
  if (status === "completed") return "sage";
  if (status === "cancelled") return "slate";
  return "amber"; // fundraising | active
}

function campaignStatusLabel(status: Campaign["status"]): string {
  if (status === "fundraising") return "Fundraising";
  if (status === "active") return "Active";
  if (status === "completed") return "Completed";
  return "Cancelled";
}

function CampaignCard({ id, campaign }: { id: string; campaign: Campaign }) {
  const raised = Number(campaign.total_raised) || 0;
  const tone = campaignStatusTone(campaign.status);
  return (
    <div className="rounded-[14px] p-5.5 flex flex-col gap-3.5" style={{ background: "var(--card)", padding: 22, gap: 14 }}>
      <div className="flex justify-between items-start gap-2.5">
        <div className="font-head text-[16.5px] leading-tight max-w-[22ch]">{campaign.title}</div>
        <span
          className="font-mono text-[9.5px] uppercase tracking-wide shrink-0"
          style={{ color: tone === "sage" ? "var(--sage-bright)" : tone === "slate" ? "var(--slate)" : "var(--amber-bright)" }}
        >
          {campaignStatusLabel(campaign.status)}
        </span>
      </div>
      <div className="progress-track">
        <div className={`progress-fill ${tone === "amber" ? "amber" : ""}`} style={{ width: `${Math.min(100, raised > 0 ? 60 : 0)}%` }} />
      </div>
      <div className="font-mono text-[11.5px]" style={{ color: "var(--sage-bright)" }}>
        {formatGen(campaign.total_raised)} GEN raised
      </div>
      <Link href={`/app?campaign=${encodeURIComponent(id)}`} className="mt-1 text-[12.5px]" style={{ color: "var(--sage-bright)" }}>
        View campaign &rarr;
      </Link>
    </div>
  );
}

export default function LandingPage() {
  const { data: list, isLoading } = useCampaignList();

  const stats = useMemo(() => {
    const rows = list ?? [];
    const totalFunded = rows.reduce((sum, r) => sum + (Number(r.campaign.total_raised) || 0), 0);
    const live = rows.filter((r) => r.campaign.status === "fundraising" || r.campaign.status === "active").length;
    return {
      totalFunded: formatGen(String(totalFunded)),
      liveCampaigns: live,
      campaignCount: rows.length,
    };
  }, [list]);

  const featured = useMemo(() => (list ?? []).slice().reverse().slice(0, 3), [list]);

  return (
    <div style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {/* nav */}
      <div
        className="flex items-center justify-between gap-4 flex-wrap px-6 sm:px-16 py-5.5"
        style={{ borderBottom: "1px solid var(--border)", padding: "22px 64px" }}
      >
        <LogoFull size="md" />
        <div className="hidden md:flex items-center gap-9 text-[13.5px]" style={{ color: "var(--muted-foreground)" }}>
          <Link href="/app">Campaigns</Link>
          <a href="#how-it-works">How it works</a>
          <Link href="/app">Create a campaign</Link>
        </div>
        <Link
          href="/app"
          className="inline-flex items-center h-[38px] px-5 rounded-full text-[12.5px] font-semibold"
          style={{ background: "var(--sage)", color: "var(--primary-foreground)" }}
        >
          Launch app
        </Link>
      </div>

      {/* hero */}
      <div className="px-6 sm:px-16 pt-16 sm:pt-24 pb-14 sm:pb-18 text-center">
        <div className="eyebrow mb-5">Verified-impact funding</div>
        <h1
          className="font-head italic mx-auto mb-5 text-[32px] sm:text-[48px] max-w-[18ch]"
          style={{ fontWeight: 500, lineHeight: 1.15, letterSpacing: "-0.01em", textWrap: "balance" }}
        >
          Public goods, funded only as they&apos;re proven.
        </h1>
        <p className="mx-auto mb-9 text-[15px] sm:text-base max-w-[46ch]" style={{ color: "var(--muted-foreground)", lineHeight: 1.65 }}>
          Each milestone releases funds only once a validator independently verifies it. No promises, no trust required &mdash; just proof.
        </p>
        <div className="flex items-center justify-center gap-3.5 flex-wrap mb-14">
          <Link
            href="/app"
            className="inline-flex items-center h-12 px-6 rounded-full text-sm font-semibold"
            style={{ background: "var(--sage)", color: "var(--primary-foreground)" }}
          >
            Explore campaigns
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center h-12 px-6 rounded-full text-sm font-medium"
            style={{ border: "1px solid var(--border-bright)" }}
          >
            How it works
          </a>
        </div>
        <div className="flex items-center justify-center flex-wrap">
          <div className="px-6 sm:px-10 text-center">
            <div className="font-mono tabular text-2xl sm:text-[28px] mb-1.5">{isLoading ? "—" : `${stats.totalFunded} GEN`}</div>
            <div className="font-mono text-[10.5px] uppercase tracking-wide" style={{ color: "var(--sage-bright)" }}>Total funded</div>
          </div>
          <div className="w-px h-10" style={{ background: "var(--border-bright)" }} />
          <div className="px-6 sm:px-10 text-center">
            <div className="font-mono tabular text-2xl sm:text-[28px] mb-1.5">{isLoading ? "—" : stats.campaignCount}</div>
            <div className="font-mono text-[10.5px] uppercase tracking-wide" style={{ color: "var(--sage-bright)" }}>Campaigns created</div>
          </div>
          <div className="w-px h-10" style={{ background: "var(--border-bright)" }} />
          <div className="px-6 sm:px-10 text-center">
            <div className="font-mono tabular text-2xl sm:text-[28px] mb-1.5">{isLoading ? "—" : stats.liveCampaigns}</div>
            <div className="font-mono text-[10.5px] uppercase tracking-wide" style={{ color: "var(--sage-bright)" }}>Live campaigns</div>
          </div>
        </div>
      </div>

      {/* campaign grid */}
      <div className="px-6 sm:px-16 py-14 sm:py-19" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-baseline justify-between mb-8 flex-wrap gap-2">
          <h2 className="font-head text-2xl" style={{ fontWeight: 500 }}>Live campaigns</h2>
          <Link href="/app" className="text-[13px]" style={{ color: "var(--sage-bright)" }}>View all campaigns &rarr;</Link>
        </div>
        {featured.length === 0 ? (
          <div
            className="p-10 flex flex-col items-center gap-3 text-center rounded-2xl"
            style={{ background: "var(--card)", border: "1px dashed var(--border-bright)" }}
          >
            <LogoMark size="lg" />
            <div className="font-mono text-sm" style={{ color: "var(--ink-faint)" }}>
              {isLoading ? "Loading campaigns…" : "No campaigns on this contract yet. Create the first one in the app."}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {featured.map(({ id, campaign }) => (
              <CampaignCard key={id} id={id} campaign={campaign} />
            ))}
          </div>
        )}
      </div>

      {/* how it works */}
      <div id="how-it-works" className="px-6 sm:px-16 py-14 sm:py-19" style={{ borderTop: "1px solid var(--border)" }}>
        <h2 className="font-head text-2xl mb-10" style={{ fontWeight: 500 }}>How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-12">
          <div>
            <div className="font-mono text-[13px] mb-3" style={{ color: "var(--ink-faint)" }}>01</div>
            <div className="text-[15px] font-semibold mb-2.5">Define milestones</div>
            <div className="text-[13px]" style={{ color: "var(--muted-foreground)", lineHeight: 1.65 }}>
              Recipients set out what they&apos;ll build and exactly how each piece will be checked, before a single token arrives.
            </div>
          </div>
          <div>
            <div className="font-mono text-[13px] mb-3" style={{ color: "var(--ink-faint)" }}>02</div>
            <div className="text-[15px] font-semibold mb-2.5">Donors fund the campaign</div>
            <div className="text-[13px]" style={{ color: "var(--muted-foreground)", lineHeight: 1.65 }}>
              Contributions pool openly on-chain. Nothing moves out until a milestone is independently verified.
            </div>
          </div>
          <div>
            <div className="font-mono text-[13px] mb-3" style={{ color: "var(--ink-faint)" }}>03</div>
            <div className="text-[15px] font-semibold mb-2.5">Funds release per milestone</div>
            <div className="text-[13px]" style={{ color: "var(--muted-foreground)", lineHeight: 1.65 }}>
              A validator checks the real-world evidence &mdash; repo, deployment, live data &mdash; and only then does that slice pay out.
            </div>
          </div>
        </div>
      </div>

      {/* footer */}
      <div
        className="flex items-center justify-between flex-wrap gap-3 px-6 sm:px-16 py-7"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          <LogoMark size="sm" />
          <span className="font-head text-sm">Covenant</span>
          <span className="text-xs ml-1.5" style={{ color: "var(--ink-faint)" }}>Built on GenLayer</span>
        </div>
        <div className="flex items-center gap-6 text-xs" style={{ color: "var(--slate)" }}>
          <a href="https://github.com/2TheMoom/covenant" target="_blank" rel="noreferrer">GitHub</a>
          <span
            className="font-mono text-[10px] uppercase tracking-wide px-2.5 py-1.5 rounded"
            style={{ border: "1px solid var(--border-bright)" }}
          >
            Bradbury Testnet
          </span>
        </div>
      </div>
    </div>
  );
}
