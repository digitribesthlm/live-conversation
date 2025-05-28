import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose'; // Using jose instead of jsonwebtoken for Edge runtime

// Get JWT_SECRET from environment variable
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('WARNING: JWT_SECRET is not defined in environment variables!');
}

const secret = new TextEncoder().encode(JWT_SECRET || 'fallback-secret-key-for-development-only');

// This function can be marked `async` if using `await` inside
export async function middleware(request) {
  // Check if the route is the login page or an API route
  const { pathname } = request.nextUrl;
  
  // Allow access to login page, static assets, and auth API routes
  if (pathname.startsWith('/login') || 
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon.ico') ||
      pathname.startsWith('/api/auth/login') || 
      pathname.startsWith('/api/auth/me')) {
    return NextResponse.next();
  }
  
  // Get the token from cookies
  const token = request.cookies.get('auth_token');
  
  // If no token and not on the login page, redirect to login
  if (!token) {
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }
  
  try {
    // Verify the token using jose (works in Edge runtime)
    await jwtVerify(token.value, secret);
    
    // Token is valid, allow access
    return NextResponse.next();
  } catch (error) {
    console.error('Token verification failed:', error);
    
    // Token is invalid, redirect to login
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth/login).*)'],
}; 