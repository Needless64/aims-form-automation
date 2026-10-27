import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Cloudflare Pages serves the site as static files, so there is no Next.js
  // server and no image optimiser. Security headers live in public/_headers,
  // which Pages applies at the edge.
  output: "export",
  images: {
    formats: ["image/webp"],
    unoptimized: true,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
