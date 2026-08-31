import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import { SiteHeader } from "./site-header";
import { ThemeProvider } from "./theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenCMS",
  description: "A calm workspace for publishing content.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const stored = localStorage.getItem("opencms-theme"); const dark = stored === "dark" || (stored !== "light" && matchMedia("(prefers-color-scheme: dark)").matches); document.documentElement.classList.toggle("dark", dark); document.documentElement.classList.toggle("theme-light", !dark); document.documentElement.style.colorScheme = dark ? "dark" : "light"; } catch {} })()`,
          }}
        />
        <ThemeProvider>
          {publishableKey ? (
            <ClerkProvider publishableKey={publishableKey}>
              <SiteHeader clerkConfigured />
              {children}
            </ClerkProvider>
          ) : (
            <>
              <SiteHeader clerkConfigured={false} />
              {children}
            </>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
