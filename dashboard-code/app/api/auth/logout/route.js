import { cookies } from 'next/headers';

export async function POST() {
  try {
    // Clear the auth cookie - properly awaited
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'auth_token',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0 // Expire immediately
    });
    
    return Response.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return Response.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
} 