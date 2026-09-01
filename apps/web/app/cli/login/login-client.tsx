"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Show, SignInButton, useAuth } from "@clerk/nextjs";
import { GeistPixelSquare } from "geist/font/pixel";

export default function CliLoginClient() {
  const params = useSearchParams();
  const { getToken, isLoaded } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const redirectUri = params.get("redirect_uri");
  const state = params.get("state");

  useEffect(() => {
    if (!isLoaded || !redirectUri) return;
    let cancelled = false;
    void getToken().then(async (sessionToken) => {
      if (cancelled) return;
      if (!sessionToken) { setError("We could not create a CLI session."); return; }
      const callback = new URL(redirectUri);
      const localHostname = callback.hostname === "127.0.0.1" || callback.hostname === "localhost";
      if (callback.protocol !== "http:" || !localHostname || callback.username || callback.password) {
        setError("The CLI callback must be a plain HTTP localhost URL.");
        return;
      }
      const response = await fetch("/api/cli/tokens", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const result = await response.json() as { token?: string; error?: string };
      if (cancelled) return;
      if (!response.ok || !result.token) {
        setError(result.error ?? "We could not create a CLI session.");
        return;
      }
      callback.searchParams.set("token", result.token);
      if (state) callback.searchParams.set("state", state);
      window.location.assign(callback.toString());
    }).catch(() => setError("We could not create a CLI session."));
    return () => { cancelled = true; };
  }, [getToken, isLoaded, redirectUri, state]);

  return (
    <main
      className="relative isolate min-h-screen overflow-hidden bg-[#000] bg-[position:center_10%] bg-no-repeat"

    >
      <div className="flex min-h-screen items-center justify-center px-6 py-16">
        <section className="flex -translate-y-[5vh] flex-col items-center text-center">
          <h1 className={`${GeistPixelSquare.className} mt-6 text-[clamp(2.5rem,5vw,5rem)] font-semibold leading-none tracking-[-0.06em] text-white`}>
            Connect your account
          </h1>

          {error && (
            <p role="alert" className={`${GeistPixelSquare.className} mt-6 border border-white bg-white px-4 py-3 text-sm text-black`}>
              {error}
            </p>
          )}
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className={`${GeistPixelSquare.className} mt-8 bg-white px-6 py-4 text-base font-semibold leading-none text-black transition hover:bg-cyan-100`}>
                Sign in to continue
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <p className={`${GeistPixelSquare.className} mt-8 border border-white/60 px-5 py-3 text-sm text-white`}>
              Finishing sign-in…
            </p>
          </Show>
        </section>
      </div>
    </main>
  );
}
