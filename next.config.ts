import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/*": ["app/data/assist/**/*"],
  },
};

export default nextConfig;
