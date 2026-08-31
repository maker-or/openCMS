"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";

export function SiteHeader({ clerkConfigured }: { clerkConfigured: boolean }) {
  const pathname = usePathname();

  // The dashboard has its own workspace chrome and should open directly into it.
  if (pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return null;

  return (
    <header className="border-b border-white/10 bg-[#0b0d10]/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link className="font-semibold tracking-tight" href="/">
          Open<span className="text-cyan-300">CMS</span>
        </Link>
        {clerkConfigured ? (
          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <Button variant="ghost">Sign in</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button>Get started</Button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link className="text-sm text-zinc-400 transition hover:text-white" href="/dashboard">
                Dashboard
              </Link>
              <UserButton />
            </Show>
          </div>
        ) : (
          <span className="text-xs text-zinc-500">Clerk not configured</span>
        )}
      </div>
    </header>
  );
}
