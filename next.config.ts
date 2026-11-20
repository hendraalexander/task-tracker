import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker runtime image.
  output: "standalone",
  experimental: {
    // Client router cache: back/forward navigation is instant for recent pages.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    serverActions: {
      // Attachments: PRD allows 25 MB per file (10 files/task).
      bodySizeLimit: "30mb",
    },
  },
  typedRoutes: false,
};

export default nextConfig;
