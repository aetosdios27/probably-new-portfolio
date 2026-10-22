import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pushpendra Singh — aetos',
    short_name: 'aetos',
    description: 'I’m aetos, a systems engineer driven mostly by curiosity and an unreasonable attention to detail.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon1', sizes: '512x512', type: 'image/png' },
    ],
  };
}
