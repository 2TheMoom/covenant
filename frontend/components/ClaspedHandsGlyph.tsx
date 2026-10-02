/**
 * A standalone, colorable clasped-hands glyph - the same mark as Logo.tsx's
 * HandsMark, but with a selectable tone so it can echo "connected/verified"
 * (sage) inside the wallet panel instead of always reading as the static
 * two-tone brand mark (sage reaching in from one side, amber from the
 * other). Two hands meeting at the grip, not symbols standing in for them -
 * tapered from wrist to fist, each a gradient of its own color, with a
 * soft seam where the grip closes.
 */

"use client";

import { useId } from "react";

const TONES = {
  brand: { a: ["#96AD89", "#5E7350"], b: ["#E8B479", "#B06E2E"] },
  sage: { a: ["#AEC2A2", "#6F8862"], b: ["#AEC2A2", "#6F8862"] },
  amber: { a: ["#E8B479", "#B06E2E"], b: ["#E8B479", "#B06E2E"] },
} as const;

const HAND = "M-6 24 C-6 10 -10 4 -10 -6 C-10 -18 10 -18 10 -6 C10 4 6 10 6 24 Z";

export function ClaspedHandsGlyph({ size = 40, tone = "brand" }: { size?: number; tone?: keyof typeof TONES }) {
  const uid = useId().replace(/[:]/g, "");
  const { a, b } = TONES[tone];

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-a`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={a[0]} />
          <stop offset="100%" stopColor={a[1]} />
        </linearGradient>
        <linearGradient id={`${uid}-b`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={b[0]} />
          <stop offset="100%" stopColor={b[1]} />
        </linearGradient>
      </defs>
      <path d={HAND} fill={`url(#${uid}-a)`} transform="translate(20 46) rotate(-28)" />
      <path d={HAND} fill={`url(#${uid}-b)`} transform="translate(44 46) rotate(28)" />
      <ellipse cx="18" cy="30" rx="4" ry="7" fill="#FFFFFF" opacity="0.15" transform="rotate(-28 18 30)" />
      <ellipse cx="46" cy="30" rx="4" ry="7" fill="#FFFFFF" opacity="0.15" transform="rotate(28 46 30)" />
      <path d="M24 25 Q32 31 40 25" stroke="#2A2117" strokeWidth="2.2" fill="none" opacity="0.45" strokeLinecap="round" />
    </svg>
  );
}
