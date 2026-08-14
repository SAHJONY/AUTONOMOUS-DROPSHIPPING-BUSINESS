import type { MetadataRoute } from "next";

const BASE = "https://www.botanicaochosi.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/shop`, changeFrequency: "daily", priority: 1 },
  ];
}
