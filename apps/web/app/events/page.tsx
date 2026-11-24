import { Bookmark } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Your events | SipMunchYap",
};

/** Placeholder until accounts and saving exist. */
export default function EventsPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="mt-4 text-3xl font-bold text-foreground inline-flex items-center gap-2">
        <Bookmark className="h-10 w-10 text-foreground/40" aria-hidden="true" />
        <span>Your saved events</span>
      </h1>
      <p className="mt-2 text-foreground/70">
        Happy hours and events you save will show up here.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-sunset px-5 text-sm font-medium text-on-accent shadow-lg transition sunset-hover"
      >
        Discover something new
      </Link>
    </main>
  );
}
