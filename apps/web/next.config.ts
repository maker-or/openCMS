import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

const configuredDevOrigins = process.env.NEXT_ALLOWED_DEV_ORIGINS
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean) ?? [];
const localDevOrigins = Object.values(networkInterfaces())
  .flatMap((addresses) => addresses ?? [])
  .filter((address) => !address.internal && address.family === "IPv4")
  .map((address) => address.address);

const securityHeaders = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@opencms/db", "@opencms/sdk"],
  // Allow the current machine's LAN addresses for local HMR without tying the
  // app to one developer's IP address. Extra hosts can be supplied as a
  // comma-separated NEXT_ALLOWED_DEV_ORIGINS value.
  allowedDevOrigins: [...new Set([...configuredDevOrigins, ...localDevOrigins])],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
