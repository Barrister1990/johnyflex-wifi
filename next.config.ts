import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { join } from "path";

function readBuildStamp() {
  try {
    const raw = readFileSync(join(process.cwd(), "build", "number.json"), "utf8");
    const data = JSON.parse(raw) as { number?: number; builtAt?: string | null };
    return {
      number: String(data.number ?? 0),
      builtAt: data.builtAt ?? "",
    };
  } catch {
    return { number: "0", builtAt: "" };
  }
}

const stamp = readBuildStamp();

const nextConfig: NextConfig = {
  // Phones hit the portal via ngrok; without this, React never hydrates
  // and package/voucher clicks do nothing in `next dev`.
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok.io",
    "*.ngrok.app",
  ],
  // pdfkit reads Helvetica.afm from disk; bundling rewrites that path to
  // something like C:\ROOT\... and export fails with ENOENT.
  serverExternalPackages: ["pdfkit"],
  env: {
    NEXT_PUBLIC_BUILD_NUMBER: stamp.number,
    NEXT_PUBLIC_BUILD_AT: stamp.builtAt,
  },
  // Captive-portal browsers cache portal HTML hard; Free Mode must stay fresh.
  async headers() {
    return [
      {
        source: "/portal/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, max-age=0",
          },
        ],
      },
      {
        source: "/api/portal/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, max-age=0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
