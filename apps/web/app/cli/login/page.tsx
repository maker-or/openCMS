import { Suspense } from "react";

import CliLoginClient from "./login-client";

export default function CliLoginPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <main
        className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#000] bg-[position:center_10%] bg-no-repeat px-6 text-center text-sm text-zinc-400"
        style={{
          backgroundImage: "url('/ascii-magic-1.png')",
          backgroundSize: "clamp(22rem, 50vw, 54rem) auto",
        }}
      >
        Clerk is not configured for this dashboard.
      </main>
    );
  }
  return (
    <Suspense
      fallback={
        <main
          className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#000] bg-[position:center_10%] bg-no-repeat px-6 text-sm text-zinc-400"
          style={{
            backgroundImage: "url('/ascii-magic-1.png')",
            backgroundSize: "clamp(22rem, 50vw, 54rem) auto",
          }}
        >
          Loading CLI sign-in…
        </main>
      }
    >
      <CliLoginClient />
    </Suspense>
  );
}
