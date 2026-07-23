import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    // PWA assets are deliberately excluded. Running the auth session refresh on
    // /sw.js, the manifest or the audio files redirects signed-out requests to
    // /login, which stops the service worker from ever registering and poisons
    // the precache with login HTML.
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|sounds/|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|js|css|woff|woff2|json|webmanifest|txt|xml)$).*)',
  ],
}
