import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/store"], disallow: ["/owner", "/api", "/?legacy=1"] },
    ],
    sitemap: "https://www.botanicaochosi.com/sitemap.xml",
    host: "https://www.botanicaochosi.com",
  };
}
