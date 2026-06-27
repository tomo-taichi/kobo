import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow larger Server Action request bodies (e.g. customer contract uploads, which
    // still send a File through a Server Action). Product photos no longer rely on this —
    // their originals upload straight to Supabase Storage from the browser.
    serverActions: {
      bodySizeLimit: "40mb",
    },
  },
};

export default nextConfig;
