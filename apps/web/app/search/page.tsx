import type { Metadata } from "next";
import { Suspense } from "react";
import { InitialLocation } from "@/components/InitialLocation";
import { MerchantList } from "@/components/MerchantList";

export const metadata: Metadata = {
  title: "Search | SipMunchYap",
  description: "Search happy hours by name, deal, cuisine, place, and time",
};

export default function SearchPage() {
  return (
    // Fills the screen under the navbar; the list and map scroll inside it.
    <main className="flex h-[calc(100dvh-var(--nav-h,4rem))] min-h-[20rem] w-full flex-col">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center text-sm text-foreground/60">
            Loading…
          </div>
        }
      >
        <InitialLocation />
        <MerchantList />
      </Suspense>
    </main>
  );
}
