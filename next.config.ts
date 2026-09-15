import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @sparticuz/chromium's Chromium binary lives in its own bin/ folder,
  // loaded at runtime via a filesystem path rather than an import -- Next's
  // automatic file tracing can't discover it that way, so the deployed
  // serverless function is missing it unless explicitly included here.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
