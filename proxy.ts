import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  if (pathname === '/login' || pathname === '/api/login' || pathname === '/favicon.ico') {
    return NextResponse.next();
  }
  
  const session = request.cookies.get('gurudash-session');
  const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;
  
  if (!session || !DASHBOARD_PASSWORD || session.value !== DASHBOARD_PASSWORD) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
