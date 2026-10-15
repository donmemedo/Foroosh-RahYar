import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // The /api rewrite buffers request bodies up to this size and silently truncates beyond it.
    // Must cover backend MAX_BODY (10 MB file + multipart overhead in backend/main.py).
    proxyClientMaxBodySize: "11mb",
  },
  // Resolved at build time; Docker passes BACKEND_URL=http://backend:8000
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.BACKEND_URL || "http://localhost:8000"}/api/:path*` }];
  },
  // Pages and static assets. CSP is per-request in proxy.ts; /api responses carry the backend's own headers.
  async headers() {
    return [
      {
        source: "/((?!api/).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }, // ignored over plain http
        ],
      },
    ];
  },
};

export default nextConfig;
