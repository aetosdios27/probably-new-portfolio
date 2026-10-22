import type { MetadataRoute } from 'next';
import { getProjects } from '@/lib/playground/projects';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aetosdios.xyz';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['/', '/playground', ...getProjects().map(({ slug }) => `/playground/${slug}`)];
  return paths.map(path => ({ url: new URL(path, siteUrl).toString() }));
}
