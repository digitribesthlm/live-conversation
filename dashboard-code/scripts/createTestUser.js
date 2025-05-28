// Script to create a test user in MongoDB
require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not defined in .env file!');
  process.exit(1);
}

// Database settings - must match those in the login route
const dbName = "seo_database";
const usersCollection = "users";

async function createTestUser() {
  console.log('Starting test user creation process...');
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const database = client.db(dbName);
    const collection = database.collection(usersCollection);
    
    // Check if user already exists
    const testEmail = "patrik@makeablesthlm.se";
    const existingUser = await collection.findOne({ email: testEmail });
    
    if (existingUser) {
      console.log(`User with email ${testEmail} already exists`);
      console.log('User details:');
      const { password, ...userDetails } = existingUser;
      console.log(JSON.stringify(userDetails, null, 2));
      return;
    }
    
    // Test user to insert
    const testUser = {
      email: testEmail,
      password: "test123", // In production, this should be hashed
      role: "admin",
      domain: "makeablesthlm.se",
      clientId: null
    };
    
    const result = await collection.insertOne(testUser);
    console.log(`Test user created with ID: ${result.insertedId}`);
    console.log(`Email: ${testUser.email}`);
    console.log(`Password: ${testUser.password}`);
    
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

createTestUser().catch(console.error); 