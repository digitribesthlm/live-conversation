import { MongoClient } from 'mongodb';

// MongoDB connection string
const uri = process.env.MONGODB_URI;

// Database settings from environment variables
const DB_NAME = process.env.DB_NAME;
const USERS_COLLECTION = process.env.USERS_COLLECTION;

export async function POST(request) {
  try {
    const { email, password, domain, role } = await request.json();
    
    // Validate inputs
    if (!email || !password) {
      return Response.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    const client = new MongoClient(uri);
    
    try {
      await client.connect();
      console.log('Connected to MongoDB for registration');
      console.log(`Using database: ${DB_NAME}, collection: ${USERS_COLLECTION}`);
      
      // Use the database and collection directly
      const database = client.db(DB_NAME);
      const collection = database.collection(USERS_COLLECTION);
      
      // Check if user already exists
      const existingUser = await collection.findOne({ email });
      
      if (existingUser) {
        return Response.json(
          { message: 'User with this email already exists' },
          { status: 409 }
        );
      }
      
      // Create new user
      const newUser = {
        email,
        password, // In production, you should hash this password
        role: role || 'user',
        domain: domain || '',
        clientId: null,
        createdAt: new Date()
      };
      
      await collection.insertOne(newUser);
      
      console.log(`User registered: ${email}`);
      console.log(`In database: ${DB_NAME}, collection: ${USERS_COLLECTION}`);
      
      return Response.json(
        { message: 'User registered successfully' },
        { status: 201 }
      );
    } finally {
      await client.close();
    }
  } catch (error) {
    console.error('Registration error:', error);
    return Response.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
} 