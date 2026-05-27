"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/history", label: "History", icon: HistoryIcon },
  { href: "/trophy-room", label: "Trophies", icon: TrophyIcon },
  { href: "/stats", label: "Stats", icon: StatsIcon },
  { href: "/settings", label: "Settings", icon: GearIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  // Hide the nav while actively scoring to maximize screen space.
  if (pathname?.startsWith("/round/active")) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t surface"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname?.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className="flex min-h-tap flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium"
                style={{ color: active ? "var(--forest)" : "var(--text-muted)" }}
              >
                <Icon active={Boolean(active)} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 11l9-7 9 7M5 10v10h14V10"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HistoryIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16M4 12h16M4 18h10"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrophyIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4h10v4a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 17h6M10 17l.5-3h3l.5 3M8 21h8"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatsIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 20V10M12 20V4M19 20v-6"
        stroke="currentColor"
        strokeWidth={active ? 2.6 : 2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function GearIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
      />
      <path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}
