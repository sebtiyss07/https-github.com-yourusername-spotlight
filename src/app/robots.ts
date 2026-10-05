import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dev-audit", "/dev-check", "/search", "/saved", "/api/"] },
    sitemap: "https://www.spotlightkt.com/sitemap.xml",
  };
}
