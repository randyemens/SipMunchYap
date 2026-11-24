import type { Metadata } from "next";
import Link from "next/link";
import { DiscoverRow } from "@/components/DiscoverRow";
import { DISCOVER_SECTIONS, DISCOVER_TOPICS } from "@/lib/discover";

export const metadata: Metadata = {
  title: "Discover something new | SipMunchYap",
  description: "Find the best happy hours near you",
};

export default function DiscoverPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-10 md:px-6 md:pt-14">
      <header>
        <h1 className="text-3xl font-bold text-foreground md:text-5xl">
          Discover something new
        </h1>
        <p className="mt-3 max-w-2xl text-base text-foreground/70 md:text-lg">
          Fresh happy hours, hidden gems, and crowd favorites around the city.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {DISCOVER_TOPICS.map((topic) => (
            <Link
              key={topic}
              href={`/search?search=${encodeURIComponent(topic)}`}
              className="rounded-full border border-line-strong bg-surface-raised px-4 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-tint-strong hover:text-foreground"
            >
              {topic}
            </Link>
          ))}
        </div>
      </header>

      <div className="mt-10 flex flex-col gap-10">
        {DISCOVER_SECTIONS.map((section) => (
          <DiscoverRow key={section.id} section={section} />
        ))}
      </div>
    </main>
  );
}
