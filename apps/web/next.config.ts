import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@opencms/db", "@opencms/sdk"],
};

export default nextConfig;
