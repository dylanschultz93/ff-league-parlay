"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The app's four sections. Flat — every screen is one tap from every other, and
 * nothing here nests deep enough to want a sidebar.
 */
const TABS = [
  { href: "/", label: "This week" },
  { href: "/history", label: "Past weeks" },
  { href: "/stats", label: "Stats" },
  { href: "/manage", label: "Manage" },
];

export default function NavTabs() {
  const pathname = usePathname();

  return (
    // The row bleeds past the header's side padding so a narrow phone scrolls
    // the last tab into reach instead of squeezing all four.
    <nav
      aria-label="Sections"
      className="-mx-5 mt-3 flex gap-5 overflow-x-auto px-5 lg:mx-0 lg:mt-3.5 lg:gap-7 lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 pb-2.5 text-[13px] whitespace-nowrap transition-colors lg:text-sm ${
              active
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink-3"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
