import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Product photo uploads send the full-resolution original to a Server Action,
    // which resizes it to WebP derivatives. Raise the default 1 MB body cap to
    // comfortably fit large camera/phone photos (client guards at 30 MB).
    serverActions: {
      bodySizeLimit: "40mb",
    },
  },
};

export default nextConfig;
