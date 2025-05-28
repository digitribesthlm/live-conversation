import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

// Get JWT_SECRET from environment variable
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('WARNING: JWT_SECRET is not defined in environment variables!');
}

export async function GET() {
  try {
    // Get the auth token from cookies - properly awaited
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    
    if (!token) {
      return Response.json(
        { message: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    try {
      // Verify and decode the token with the secure secret
      const user = verify(
        token.value, 
        JWT_SECRET || 'fallback-secret-key-for-development-only'
      );
      return Response.json(user);
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError);
      return Response.json(
        { message: 'Invalid token' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Auth check error:', error);
    return Response.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
} 