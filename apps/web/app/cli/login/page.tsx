import { Suspense } from "react";

import CliLoginClient from "./login-client";

export default function CliLoginPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <main className="flex min-h-screen items-center justify-center bg-[#0b0d10] px-6 text-center text-sm text-zinc-400">Clerk is not configured for this dashboard.</main>;
  }
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#0b0d10] px-6 text-sm text-zinc-400">Loading CLI sign-in…</main>}>
      <CliLoginClient />
    </Suspense>
  );
}
