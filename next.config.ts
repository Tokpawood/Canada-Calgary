import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Version de ce déploiement, comparée à celle en ligne pour proposer de recharger (iPad).
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
