"use client";

import { Bookmark, Compass, Search, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SmyLogo } from "@/components/SmyLogo";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Discover",
    icon: Compass,
    isActive: (pathname) => pathname === "/",
  },
  {
    href: "/search",
    label: "Search",
    icon: Search,
    isActive: (pathname) => pathname.startsWith("/search"),
  },
  {
    href: "/events",
    label: "Saved",
    icon: Bookmark,
    isActive: (pathname) => pathname.startsWith("/events"),
  },
];

/**
 * Site-wide nav. Wide screens: a sticky top bar with the logo on the left, the
 * main sections in the middle and the account button on the right. Narrow
 * screens: a mobile-style bottom tab bar (no logo, icons evenly spaced).
 * The root layout reserves `--nav-h` of bottom padding for it on narrow screens.
 */
export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 bottom-0 z-50 h-[var(--nav-h,4rem)] w-full border-t border-line bg-background md:sticky md:inset-x-auto md:top-0 md:bottom-auto md:shrink-0 md:border-t-0 md:border-b">
      <div className="flex h-full w-full items-center md:grid md:grid-cols-[1fr_auto_1fr] md:gap-2 md:px-6">
        <Link
          href="/"
          aria-label="SipMunchYap home"
          className="hidden justify-self-start md:block"
        >
          <SmyLogo className="w-[104px]" />
        </Link>

        {/* Below md the nav dissolves so its links share the row with Account. */}
        <nav aria-label="Main" className="contents md:flex md:items-center md:gap-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon, isActive }) => {
            const active = isActive(pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                title={label}
                className={`inline-flex h-full flex-1 items-center justify-center gap-2 text-sm font-medium transition-colors md:h-10 md:flex-none md:rounded-full md:px-4 ${
                  active
                    ? "text-foreground md:bg-tint-strong"
                    : "text-foreground/70 hover:text-foreground md:hover:bg-tint"
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${active ? "text-sunset-amber" : ""}`}
                  aria-hidden="true"
                />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Placeholder: account / login gets wired up later. */}
        <button
          type="button"
          aria-label="Account"
          title="Account"
          className="inline-flex h-full flex-1 items-center justify-center text-foreground/70 transition-colors hover:text-foreground md:h-10 md:w-10 md:flex-none md:justify-self-end md:rounded-full md:hover:bg-tint"
        >
          <UserRound className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
