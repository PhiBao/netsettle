import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@netting/core", "@netting/canton-gateway", "@netting/typesafe-judgments"],
};

export default nextConfig;
