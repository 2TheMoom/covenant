/**
 * Covenant Logo Component
 *
 * Two hands meeting at the grip - the literal object a covenant is, an
 * agreement two parties shake on. Sage reaching in from one side, amber
 * from the other, each tapered from wrist to fist with a quiet highlight
 * giving real form instead of a flat silhouette. A soft seam marks where
 * the grip closes.
 */

import React from "react";
import { ClaspedHandsGlyph } from "./ClaspedHandsGlyph";

export type LogoVariant = "full" | "mark" | "wordmark";
export type LogoSize = "sm" | "md" | "lg";

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
}

const sizeMap = {
  sm: 26,
  md: 32,
  lg: 44,
};

function HandsMark({ size }: { size: number }) {
  return (
    <span className="shrink-0 inline-flex" aria-label="Covenant">
      <ClaspedHandsGlyph size={size} tone="brand" />
    </span>
  );
}

export function Logo({ variant = "full", size = "md", className = "" }: LogoProps) {
  const markSize = sizeMap[size];

  const Wordmark = () => (
    <span className="font-head text-foreground" style={{ fontSize: "1.2rem" }}>
      Covenant
    </span>
  );

  if (variant === "mark") {
    return <div className={`inline-flex items-center ${className}`}><HandsMark size={markSize} /></div>;
  }
  if (variant === "wordmark") {
    return <div className={`inline-flex items-center ${className}`}><Wordmark /></div>;
  }
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <HandsMark size={markSize} />
      <Wordmark />
    </div>
  );
}

export function LogoFull(props: Omit<LogoProps, "variant">) {
  return <Logo {...props} variant="full" />;
}

export function LogoMark(props: Omit<LogoProps, "variant">) {
  return <Logo {...props} variant="mark" />;
}

export function LogoWordmark(props: Omit<LogoProps, "variant">) {
  return <Logo {...props} variant="wordmark" />;
}
