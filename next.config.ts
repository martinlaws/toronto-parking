import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true, // PPR is the default under this flag; non-experimental since 16.0
  partialPrefetching: true, // 16.3+: App Shell prefetch
  typedRoutes: true, // /cards/[n] and /b/[code] links are generated in loops
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
