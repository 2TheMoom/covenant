"use client";

import { useState } from "react";
import { useWallet } from "@/lib/genlayer/wallet";
import { GENLAYER_NETWORK } from "@/lib/genlayer/client";
import { error, userRejected } from "@/lib/utils/toast";

const METAMASK_INSTALL_URL = "https://metamask.io/download/";

function WalletIcon({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="6" width="20" height="14" rx="3" fill="none" stroke={color} strokeWidth="1.8" />
      <circle cx="17" cy="13" r="1.7" fill={color} />
    </svg>
  );
}

function ComingSoonRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3.5 px-3.5 py-3 rounded-xl opacity-50" style={{ background: "var(--background)" }}>
      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "var(--secondary)" }}>
        <WalletIcon color="var(--ink-faint)" />
      </div>
      <div className="flex-1 text-sm font-medium">{label}</div>
      <span className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-1 rounded" style={{ color: "var(--ink-faint)" }}>
        Soon
      </span>
    </div>
  );
}

export function AccountPanel() {
  const {
    address, isConnected, isMetaMaskInstalled, isOnCorrectNetwork, isLoading,
    connectWallet, disconnectWallet, switchWalletAccount,
  } = useWallet();

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const handleConnect = async () => {
    if (!isMetaMaskInstalled) return;
    try {
      setIsConnecting(true);
      await connectWallet();
      setIsPanelOpen(false);
    } catch (err: any) {
      if (err.message?.includes("rejected")) {
        userRejected("Connection cancelled");
      } else {
        error("Failed to connect", { description: err.message || "Check your MetaMask and try again." });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSwitchAccount = async () => {
    try {
      setIsSwitching(true);
      await switchWalletAccount();
    } catch (err: any) {
      if (!err.message?.includes("rejected")) {
        error("Failed to switch account", { description: err.message || "Please try again." });
      } else {
        userRejected("Account switch cancelled");
      }
    } finally {
      setIsSwitching(false);
    }
  };

  const networkLabel = GENLAYER_NETWORK.chainName.replace(/^GenLayer\s+/i, "");

  return (
    <div className="relative">
      <button type="button" onClick={() => setIsPanelOpen((v) => !v)} disabled={isLoading} className="wallet-chip">
        <span className={`mark-dot ${isConnected ? "" : "off"}`} />
        {isConnected && address ? `0x${address.slice(2, 6)}…${address.slice(-4)}` : "Connect Wallet"}
      </button>

      {isPanelOpen && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: "rgba(10,8,5,0.72)" }} onClick={() => setIsPanelOpen(false)} />
          <div
            className="fixed left-4 right-4 sm:left-auto sm:right-5 top-[86px] z-50 sm:w-[340px] p-6 rounded-[18px]"
            style={{ background: "var(--card)", border: "1px solid var(--border-bright)", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}
          >
            {!isConnected ? (
              <>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-head text-lg">Connect a wallet</span>
                  <button
                    type="button"
                    onClick={() => setIsPanelOpen(false)}
                    className="w-6.5 h-6.5 rounded-full flex items-center justify-center text-sm"
                    style={{ color: "var(--ink-faint)", border: "1px solid var(--border)", width: 26, height: 26 }}
                  >
                    &times;
                  </button>
                </div>
                <p className="text-xs mb-5.5" style={{ color: "var(--muted-foreground)", marginBottom: 22 }}>
                  Choose how you&apos;d like to connect to Covenant.
                </p>

                <div className="flex flex-col gap-2">
                  {!isMetaMaskInstalled && (
                    <button type="button" onClick={() => window.open(METAMASK_INSTALL_URL, "_blank")} className="btn-field solid w-full">
                      Install MetaMask
                    </button>
                  )}
                  {isMetaMaskInstalled && (
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={isConnecting}
                      className="flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-left"
                      style={{ background: "var(--background)", border: "1px solid var(--border-bright)" }}
                    >
                      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "var(--secondary)" }}>
                        <WalletIcon color="var(--brass-bright)" />
                      </div>
                      <div className="flex-1 text-sm font-medium">{isConnecting ? "Connecting…" : "MetaMask"}</div>
                      <span
                        className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-1 rounded"
                        style={{ color: "var(--moss)", background: "var(--secondary)" }}
                      >
                        Popular
                      </span>
                    </button>
                  )}
                  <ComingSoonRow label="WalletConnect" />
                  <ComingSoonRow label="Coinbase Wallet" />
                </div>

                <p className="mt-5 text-center text-[11px] leading-relaxed" style={{ color: "var(--ink-faint)" }}>
                  By connecting, you acknowledge the {networkLabel} is for testing only.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-head text-lg">Your wallet</span>
                  <button
                    type="button"
                    onClick={() => setIsPanelOpen(false)}
                    className="rounded-full flex items-center justify-center text-sm"
                    style={{ color: "var(--ink-faint)", border: "1px solid var(--border)", width: 26, height: 26 }}
                  >
                    &times;
                  </button>
                </div>
                <div className="flex flex-col gap-2 mb-5 font-mono text-xs">
                  <div className="flex justify-between py-2" style={{ borderBottom: "1px dotted var(--border)" }}>
                    <span style={{ color: "var(--ink-faint)" }}>ADDRESS</span>
                    <span>{address ? `0x${address.slice(2, 6)}…${address.slice(-4)}` : "—"}</span>
                  </div>
                  <div className="flex justify-between py-2" style={{ borderBottom: "1px dotted var(--border)" }}>
                    <span style={{ color: "var(--ink-faint)" }}>NETWORK</span>
                    <span style={{ color: isOnCorrectNetwork ? "var(--moss)" : "var(--rust)" }}>
                      {isOnCorrectNetwork ? `${networkLabel} ✓` : "Wrong network"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={handleSwitchAccount} disabled={isSwitching} className="btn-field ghost w-full">
                    {isSwitching ? "Switching…" : "Switch account"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { disconnectWallet(); setIsPanelOpen(false); }}
                    className="btn-field danger w-full"
                  >
                    Disconnect
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
