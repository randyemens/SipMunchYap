"use client";

import { useRouter } from "next/navigation";

/** Standalone restaurant page only (e.g. opened in a new tab). */
export function BackToResultsLink() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push("/search");
      }}
      className="mb-5 inline-flex text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
    >
      ← Back to search
    </button>
  );
}
