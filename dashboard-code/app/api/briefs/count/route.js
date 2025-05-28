import { MongoClient } from 'mongodb';
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

export async function GET(request) {
  // Get auth token
  const cookieStore = cookies();
  const token = cookieStore.get('auth_token')?.value;
  const user = getUserFromToken(token);
  
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');
  const minScore = searchParams.get('minScore');
  const maxScore = searchParams.get('maxScore');
  const domain = searchParams.get('domain');
  
  console.log(`Count API filters: keyword=${keyword || 'none'}, minScore=${minScore || 'none'}, maxScore=${maxScore || 'none'}, domain=${domain || 'none'}`);
  console.log(`User: ${user.email}, role: ${user.role}, domain: ${user.domain}`);
  console.log(`Using database: ${DB_NAME}, collection: ${BRIEFS_COLLECTION}`);
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const database = client.db(DB_NAME);
    const collection = database.collection(BRIEFS_COLLECTION);
    
    // Build query based on filters (same as main briefs endpoint)
    const query = {};
    
    if (keyword) {
      query.keyword = { $regex: keyword, $options: 'i' };
    }
    
    // Handle score filtering
    if (minScore || maxScore) {
      query.coverage_score = {};
      
      if (minScore && minScore.trim() !== '') {
        query.coverage_score.$gte = parseInt(minScore, 10);
      }
      
      if (maxScore && maxScore.trim() !== '') {
        query.coverage_score.$lte = parseInt(maxScore, 10);
      }
    }
    
    // Domain filtering logic (same as main briefs endpoint):
    // 1. If user is admin and no domain filter is provided, show all briefs
    // 2. If user is admin and domain filter is provided, filter by that domain
    // 3. If user is not admin, always filter by their domain
    if (user.role !== 'admin') {
      // Non-admin users can only see briefs for their domain
      query.domain = user.domain;
      console.log(`Non-admin user: Filtering by domain ${user.domain}`);
    } else if (domain) {
      // Admin user with explicit domain filter
      query.domain = domain;
      console.log(`Admin user with domain filter: ${domain}`);
    } else {
      console.log('Admin user: Showing all domains');
    }
    
    console.log('MongoDB query:', JSON.stringify(query));
    
    // Get total count
    const totalCount = await collection.countDocuments(query);
    console.log(`Total briefs count: ${totalCount}`);
    
    return Response.json({ count: totalCount });
  } catch (error) {
    console.error('Database count error:', error);
    return Response.json({ error: 'Failed to fetch count' }, { status: 500 });
  } finally {
    await client.close();
  }
} 