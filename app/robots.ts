import type { MetadataRoute } from "next";

/** Site is soft-launched — keep crawlers out for now. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
