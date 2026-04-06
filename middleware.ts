// middleware.ts

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './lib/auth'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Public paths
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Protect dashboard and API routes
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/')) {
    const token = req.cookies.get('mws_session')?.value

    if (!token) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/login', req.url))
    }

    const session = await verifyToken(token)
    if (!session) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/login'],
}
