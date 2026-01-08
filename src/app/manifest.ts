import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '리뉴얼 견적 시스템',
    short_name: '리뉴얼 견적',
    description: '리뉴얼 공사 예가 산출 시스템',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1e1b4b',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      }
    ],
  }
}
