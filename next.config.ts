import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["chromadb"],
  // Default proxy body limit is 10MB; larger multipart uploads get truncated and FormData parse fails.
  experimental: {
    // Parts are 8MB; keep headroom for multipart overhead.
    proxyClientMaxBodySize: "20mb",
  },
};

export default nextConfig;
