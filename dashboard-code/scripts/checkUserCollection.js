// Script to check MongoDB collections from environment variables
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not defined in .env.local file!');
  process.exit(1);
}

// Get database and collection names from environment variables
const DB_NAME = process.env.DB_NAME;
const USERS_COLLECTION = process.env.USERS_COLLECTION;
const BRIEFS_COLLECTION = process.env.CONTENT_BRIEFS_COLLECTION;

console.log('Environment variables:');
console.log(`- DB_NAME: ${DB_NAME}`);
console.log(`- USERS_COLLECTION: ${USERS_COLLECTION}`);
console.log(`- BRIEFS_COLLECTION: ${BRIEFS_COLLECTION}`);

async function checkCollections() {
  console.log(`\nChecking database "${DB_NAME}" collections...`);
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const database = client.db(DB_NAME);
    
    // List all collections
    const collections = await database.listCollections().toArray();
    console.log("\nAvailable collections:");
    collections.forEach(coll => {
      console.log(`- ${coll.name}`);
    });
    
    // Check users collection
    if (USERS_COLLECTION) {
      console.log(`\nChecking ${USERS_COLLECTION} collection:`);
      const usersCollection = database.collection(USERS_COLLECTION);
      const usersCount = await usersCollection.countDocuments();
      console.log(`Total documents in ${USERS_COLLECTION}: ${usersCount}`);
      
      if (usersCount > 0) {
        // List sample users
        const users = await usersCollection.find({}).limit(5).toArray();
        console.log("\nSample user documents:");
        users.forEach((user, i) => {
          console.log(`\nUser ${i+1}:`);
          Object.keys(user).forEach(key => {
            const value = key === 'password' ? '[REDACTED]' : user[key];
            console.log(`- ${key}: ${value}`);
          });
        });
        
        // Check for specific user
        const targetEmail = "patrik@makeablesthlm.se";
        const user = await usersCollection.findOne({ email: targetEmail });
        
        if (user) {
          console.log(`\n✅ Found user with email: ${targetEmail} in ${USERS_COLLECTION}`);
        } else {
          console.log(`\n❌ User with email ${targetEmail} not found in ${USERS_COLLECTION}`);
        }
      }
    } else {
      console.log('\nUSERS_COLLECTION not defined in environment variables');
    }
    
    // Check briefs collection
    if (BRIEFS_COLLECTION) {
      console.log(`\nChecking ${BRIEFS_COLLECTION} collection:`);
      const briefsCollection = database.collection(BRIEFS_COLLECTION);
      const briefsCount = await briefsCollection.countDocuments();
      console.log(`Total documents in ${BRIEFS_COLLECTION}: ${briefsCount}`);
      
      if (briefsCount > 0) {
        // List sample briefs
        const briefs = await briefsCollection.find({}).limit(2).toArray();
        console.log("\nSample brief documents (first 3 fields only):");
        briefs.forEach((brief, i) => {
          console.log(`\nBrief ${i+1}:`);
          const keys = Object.keys(brief).slice(0, 3);
          keys.forEach(key => {
            console.log(`- ${key}: ${brief[key]}`);
          });
          console.log(`... and ${Object.keys(brief).length - 3} more fields`);
        });
      }
    } else {
      console.log('\nBRIEFS_COLLECTION not defined in environment variables');
    }
    
  } catch (error) {
    console.error('Error checking collections:', error);
  } finally {
    await client.close();
    console.log('\nMongoDB connection closed');
  }
}

checkCollections().catch(console.error); 