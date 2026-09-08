import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/*": ["app/data/assist/**/*", "app/data/usc/**/*"],
  },
};

export default nextConfig;
