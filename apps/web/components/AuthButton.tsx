import Link from "next/link";

/**
 * UI-only stub of the Lovable AuthButton.
 * Auth/session wiring will replace this once the API is ready.
 */
export function AuthButton() {
  return (
    <Link
      href="/auth"
      className="inline-flex h-11 items-center justify-center rounded-md border border-line-strong bg-surface-raised px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-tint-strong"
    >
      Sign In
    </Link>
  );
}
