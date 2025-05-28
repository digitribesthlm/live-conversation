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
  const sortBy = searchParams.get('sortBy') || 'creation_date';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const skip = (page - 1) * limit;
  
  console.log(`API received: sortBy=${sortBy}, sortOrder=${sortOrder}, page=${page}, limit=${limit}`);
  console.log(`Filters: keyword=${keyword || 'none'}, minScore=${minScore || 'none'}, maxScore=${maxScore || 'none'}, domain=${domain || 'none'}`);
  console.log(`User: ${user.email}, role: ${user.role}, domain: ${user.domain}`);
  console.log(`Using database: ${DB_NAME}, collection: ${BRIEFS_COLLECTION}`);
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const database = client.db(DB_NAME);
    const collection = database.collection(BRIEFS_COLLECTION);
    
    // Build query based on filters
    const query = {};
    
    if (keyword) {
      query.keyword = { $regex: keyword, $options: 'i' };
    }
    
    // Handle score filtering
    if (minScore || maxScore) {
      query.coverage_score = {};
      
      // Convert to numbers for proper comparison
      if (minScore && minScore.trim() !== '') {
        query.coverage_score.$gte = parseInt(minScore, 10);
        console.log(`Min score filter: >= ${parseInt(minScore, 10)}`);
      }
      
      if (maxScore && maxScore.trim() !== '') {
        query.coverage_score.$lte = parseInt(maxScore, 10);
        console.log(`Max score filter: <= ${parseInt(maxScore, 10)}`);
      }
    }
    
    // Domain filtering logic:
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
    
    // Build sort options - ensure numeric sorting for scores
    const sortOptions = {};
    if (sortBy === 'coverage_score') {
      // Make sure coverage_score is treated as a number
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }
    
    console.log('MongoDB query:', JSON.stringify(query));
    console.log('MongoDB sort:', JSON.stringify(sortOptions));
    
    // Execute query with pagination
    const briefs = await collection.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .toArray();
    
    console.log(`Found ${briefs.length} results`);
    
    return Response.json(briefs);
  } catch (error) {
    console.error('Database error:', error);
    return Response.json({ error: 'Failed to fetch data' }, { status: 500 });
  } finally {
    await client.close();
  }
}
