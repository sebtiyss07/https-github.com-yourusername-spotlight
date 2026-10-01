import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dev-audit", "/dev-check", "/search"] },
    sitemap: "https://spotlight-steel.vercel.app/sitemap.xml",
  };
}
