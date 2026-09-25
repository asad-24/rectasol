import type { MetadataRoute } from "next";
import { caseStudies, navItems, services } from "@/data/site";
import { SITE_URL } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...navItems.map(({ href }) => href),
    ...services.map(({ slug }) => `/services/${slug}`),
    ...caseStudies.map(({ slug }) => `/case-studies/${slug}`),
  ].map((path) => ({ url: new URL(path, SITE_URL).href }));
}
