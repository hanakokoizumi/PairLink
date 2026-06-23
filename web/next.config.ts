import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const api =
      process.env.INTERNAL_API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://localhost:8080";
    return [
      {
        source: "/api/:path*",
        destination: `${api}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${api}/health`,
      },
      {
        source: "/ws",
        destination: `${api}/ws`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
