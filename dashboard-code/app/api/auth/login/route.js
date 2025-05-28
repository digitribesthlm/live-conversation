import { MongoClient } from 'mongodb';
import { cookies } from 'next/headers';
import { sign } from 'jsonwebtoken';

// MongoDB connection string
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not defined!');
}

// Get JWT_SECRET from environment variable
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('WARNING: JWT_SECRET is not defined in environment variables!');
}

// Database settings from environment variables
const DB_NAME = process.env.DB_NAME;
const USERS_COLLECTION = process.env.USERS_COLLECTION;

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    
    console.log(`Login attempt for email: ${email}`);
    console.log(`Using database: ${DB_NAME}, collection: ${USERS_COLLECTION}`);
    
    if (!email || !password) {
      console.log('Login failed: Email or password missing');
      return Response.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    const client = new MongoClient(uri);
    
    try {
      console.log('Connecting to MongoDB...');
      await client.connect();
      console.log('Connected to MongoDB');
      
      // Use the database and collection directly
      const database = client.db(DB_NAME);
      const collection = database.collection(USERS_COLLECTION);
      
      // Try to find the user with exact email match
      console.log(`Searching for user with email: ${email}`);
      const user = await collection.findOne({ email: email });
      
      if (!user) {
        console.log(`User not found with email: ${email}`);
        return Response.json(
          { message: 'Invalid email or password' },
          { status: 401 }
        );
      }
      
      console.log(`User found: ${user.email}`);
      
      // Simple string comparison for password
      // In production, you should use proper password hashing
      const passwordMatches = String(user.password) === String(password);
      
      if (!passwordMatches) {
        console.log('Password does not match');
        return Response.json(
          { message: 'Invalid email or password' },
          { status: 401 }
        );
      }
      
      console.log('Password matches! Authentication successful');
      
      // Create user object without sensitive data
      const userWithoutPassword = {
        id: user._id.toString(),
        email: user.email,
        role: user.role || 'user',
        domain: user.domain || '',
        clientId: user.clientId || null
      };
      
      // Create JWT token with the secure secret
      const token = sign(
        userWithoutPassword, 
        JWT_SECRET || 'fallback-secret-key-for-development-only',
        { expiresIn: '8h' }
      );
      
      // Set cookie
      const cookieStore = await cookies();
      cookieStore.set({
        name: 'auth_token',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 8 * 60 * 60 // 8 hours
      });
      
      console.log('Authentication cookie set successfully');
      return Response.json(userWithoutPassword);
    } finally {
      await client.close();
      console.log('MongoDB connection closed');
    }
  } catch (error) {
    console.error('Login error:', error);
    return Response.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
} 