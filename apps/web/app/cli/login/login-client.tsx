"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Show, SignInButton, useAuth } from "@clerk/nextjs";

export default function CliLoginClient() {
  const params = useSearchParams();
  const { getToken, isLoaded } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const redirectUri = params.get("redirect_uri");

  useEffect(() => {
    if (!isLoaded || !redirectUri) return;
    let cancelled = false;
    void getToken().then((token) => {
      if (cancelled) return;
      if (!token) { setError("We could not create a CLI session."); return; }
      const callback = new URL(redirectUri);
      if (callback.hostname !== "127.0.0.1" && callback.hostname !== "localhost") {
        setError("The CLI callback must point to localhost.");
        return;
      }
      callback.searchParams.set("token", token);
      window.location.assign(callback.toString());
    }).catch(() => setError("We could not create a CLI session."));
    return () => { cancelled = true; };
  }, [getToken, isLoaded, redirectUri]);

  return <main className="flex min-h-screen items-center justify-center bg-[#0b0d10] px-6"><div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/30"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-cyan-300 text-sm font-semibold text-black">OC</div><p className="mt-6 text-xs uppercase tracking-[0.22em] text-cyan-300">OpenCMS CLI</p><h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Connect this terminal.</h1><p className="mt-3 text-sm leading-6 text-zinc-400">Sign in once, then return to your terminal to create and deploy projects.</p>{error && <p className="mt-5 rounded-xl bg-red-300/10 px-3 py-2 text-xs text-red-200">{error}</p>}<Show when="signed-out"><SignInButton mode="modal"><button className="mt-7 w-full rounded-full bg-white py-3 text-sm font-medium text-black transition hover:bg-cyan-100">Sign in to continue</button></SignInButton></Show><Show when="signed-in"><p className="mt-7 rounded-full border border-cyan-300/20 bg-cyan-300/10 py-3 text-sm text-cyan-100">Finishing sign-in…</p></Show></div></main>;
}
