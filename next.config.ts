import withMDX from '@next/mdx'
import { NextConfig } from 'next'

export default withMDX()({
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  turbopack: {},
  experimental: {
    mdxRs: {
      mdxType: 'gfm',
    },
  },
  transpilePackages: ['shiki'],
  images: {
    contentDispositionType: 'inline',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    qualities: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.notionusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/api/photos/image/**',
      },
      {
        protocol: 'https',
        hostname: 'photo.1chooo.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.telegram.org',
        port: '',
        pathname: '/**',
      },
    ],
    minimumCacheTTL: 31536000, // 1 year cache for images
  },
} satisfies NextConfig)
