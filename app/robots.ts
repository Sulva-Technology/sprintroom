import { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/demo'],
      disallow: [
        '/dashboard',
        '/projects',
        '/team-pulse',
        '/focus-sessions',
        '/settings',
        '/focus',
        '/onboarding',
        '/api',
        '/auth',
        '/login',
        '/signup',
        '/invite',
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
