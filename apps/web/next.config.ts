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

const nextConfig: NextConfig = {
  transpilePackages: ["@opencms/db", "@opencms/sdk"],
  // Allow the current machine's LAN addresses for local HMR without tying the
  // app to one developer's IP address. Extra hosts can be supplied as a
  // comma-separated NEXT_ALLOWED_DEV_ORIGINS value.
  allowedDevOrigins: [...new Set([...configuredDevOrigins, ...localDevOrigins])],
};

export default nextConfig;
