import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Resolved at build time; Docker passes BACKEND_URL=http://backend:8000
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.BACKEND_URL || "http://localhost:8000"}/api/:path*` }];
  },
};

export default nextConfig;
