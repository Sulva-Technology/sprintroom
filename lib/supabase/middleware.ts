import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function isLocalDevelopmentRequest(request: NextRequest) {
  return ['localhost', '127.0.0.1', '::1'].includes(request.nextUrl.hostname)
}

function isSupabaseReachabilityError(error: unknown) {
  if (!(error instanceof Error)) return false

  return (
    error.name === 'AuthRetryableFetchError' ||
    error.message.includes('fetch failed') ||
    error.message.includes('Failed to fetch')
  )
}

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/update-password') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/invite') ||
    pathname === '/' ||
    pathname.startsWith('/setup') ||
    // The PWA offline fallback holds no user data and must stay reachable
    // signed-out; redirecting it to /login would cache login HTML as the
    // offline page.
    pathname === '/offline'
  )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Prevent supabase from crashing if env vars are missing during setup
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser().catch((error: unknown) => {
    if (isLocalDevelopmentRequest(request) && isSupabaseReachabilityError(error)) {
      return { data: { user: null }, error }
    }

    throw error
  })

  if (isLocalDevelopmentRequest(request) && !user) {
    try {
      const healthUrl = new URL('/auth/v1/health', process.env.NEXT_PUBLIC_SUPABASE_URL!)
      const response = await fetch(healthUrl, { cache: 'no-store' })
      if (!response.ok) return supabaseResponse
    } catch {
      return supabaseResponse
    }
  }

  if (
    !user && 
    !isPublicPath(request.nextUrl.pathname)
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname === '/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
