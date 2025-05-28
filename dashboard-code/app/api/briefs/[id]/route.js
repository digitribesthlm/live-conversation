import { MongoClient, ObjectId } from 'mongodb';
import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';

// MongoDB connection string
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not defined!');
}

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('WARNING: JWT_SECRET is not defined!');
}

// Database settings from environment variables
const DB_NAME = process.env.DB_NAME;
const BRIEFS_COLLECTION = process.env.CONTENT_BRIEFS_COLLECTION;

// Helper function to get user from token
const getUserFromToken = (token) => {
  try {
    if (!token) return null;
    return verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
};

export async function GET(request, { params }) {
  // Get auth token
  const cookieStore = cookies();
  const token = cookieStore.get('auth_token')?.value;
  const user = getUserFromToken(token);
  
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Wait for params to be fully available
  const id = await params.id;
  
  console.log(`Fetching brief with ID: ${id}`);
  console.log(`User: ${user.email}, role: ${user.role}, domain: ${user.domain}`);
  console.log(`Using database: ${DB_NAME}, collection: ${BRIEFS_COLLECTION}`);
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const database = client.db(DB_NAME);
    const collection = database.collection(BRIEFS_COLLECTION);
    
    // Find the brief by brief_id
    const brief = await collection.findOne({ brief_id: id });
    
    if (!brief) {
      console.log(`Brief not found with ID: ${id}`);
      return Response.json({ error: 'Brief not found' }, { status: 404 });
    }
    
    // Check domain permissions
    // 1. If user is admin, allow access to any brief
    // 2. If user is not admin, only allow access to briefs with matching domain
    if (user.role !== 'admin' && brief.domain !== user.domain) {
      console.log(`Access denied: User domain (${user.domain}) doesn't match brief domain (${brief.domain})`);
      return Response.json({ error: 'You do not have permission to access this brief' }, { status: 403 });
    }
    
    console.log(`Found brief: ${brief.keyword}, domain: ${brief.domain}`);
    return Response.json(brief);
  } catch (error) {
    console.error('Database error:', error);
    return Response.json({ error: 'Failed to fetch brief details' }, { status: 500 });
  } finally {
    await client.close();
  }
}
