"use client";

import Link from "next/link";
import type { HoleClassification } from "@/lib/scoring";
import { CLASSIFICATION_LABELS } from "@/lib/scoring";

export function PageHeader({
  title,
  subtitle,
  back,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label?: string };
}) {
  return (
    <header className="mb-4">
      {back && (
        <Link
          href={back.href}
          className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-muted"
        >
          <span aria-hidden>‹</span> {back.label ?? "Back"}
        </Link>
      )}
      <h1 className="text-2xl font-bold" style={{ color: "var(--forest)" }}>
        {title}
      </h1>
      {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
    </header>
  );
}

const CLASS_STYLES: Record<HoleClassification, { bg: string; fg: string }> = {
  eagle: { bg: "#B45309", fg: "#fff" },
  birdie: { bg: "#14532D", fg: "#fff" },
  par: { bg: "#1E3A5F", fg: "#fff" },
  bogey: { bg: "var(--surface-2)", fg: "var(--text)" },
  other: { bg: "var(--surface-2)", fg: "var(--text-muted)" },
  none: { bg: "transparent", fg: "var(--text-muted)" },
};

export function ClassificationBadge({
  classification,
  points,
}: {
  classification: HoleClassification;
  points?: number;
}) {
  const s = CLASS_STYLES[classification];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {CLASSIFICATION_LABELS[classification]}
      {points !== undefined && classification !== "none" && (
        <span className="opacity-80">+{points}</span>
      )}
    </span>
  );
}

export function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "gold" | "forest" | "navy";
}) {
  const bg =
    tone === "gold"
      ? "var(--gold)"
      : tone === "forest"
        ? "var(--forest)"
        : tone === "navy"
          ? "var(--navy)"
          : "var(--surface-2)";
  const fg = tone === "default" ? "var(--text)" : "#fff";
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: bg, color: fg }}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <div className="card text-center">
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 text-sm text-muted">{body}</p>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex h-40 items-center justify-center text-muted">
      Loading…
    </div>
  );
}
