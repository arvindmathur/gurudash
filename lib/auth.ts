import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

export async function getSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('gurudash-session');
  const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;
  
  return !!session && !!DASHBOARD_PASSWORD && session.value === DASHBOARD_PASSWORD;
}

export function isAuthenticated(request: NextRequest): boolean {
  const session = request.cookies.get('gurudash-session');
  const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;
  
  return !!session && !!DASHBOARD_PASSWORD && session.value === DASHBOARD_PASSWORD;
}
