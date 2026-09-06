import type { MetadataRoute } from "next";

/**
 * `/api/` is the mirror, not content. `/b/<code>` is kept out of search by its
 * own `robots: { index: false }` metadata rather than a line here, because a
 * disallow list would publish the shape of the capability URLs.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
  };
}
