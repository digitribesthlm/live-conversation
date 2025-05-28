// Script to check the MongoDB database structure
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not defined in .env.local file!');
  process.exit(1);
}

// Collection name to look for
const USERS_COLLECTION = 'seo-manager';

async function checkDatabase() {
  console.log('Checking MongoDB database structure...');
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    // List all databases
    const adminDb = client.db('admin');
    const dbs = await adminDb.admin().listDatabases();
    console.log('Available databases:');
    dbs.databases.forEach(db => {
      console.log(`- ${db.name}`);
    });
    
    // Check all collections in each database
    for (const db of dbs.databases) {
      if (db.name !== 'admin' && db.name !== 'local') {
        const database = client.db(db.name);
        const collections = await database.listCollections().toArray();
        
        console.log(`\nCollections in database "${db.name}":`);
        if (collections.length === 0) {
          console.log('  (no collections)');
          continue;
        }
        
        for (const coll of collections) {
          const count = await database.collection(coll.name).countDocuments();
          console.log(`- ${coll.name} (${count} documents)`);
          
          // If this collection has users, examine it
          if (count > 0) {
            // Check for email field in any document
            const sampleWithEmail = await database.collection(coll.name).findOne({ email: { $exists: true } });
            if (sampleWithEmail) {
              console.log(`  ✅ Collection contains documents with email field`);
              console.log(`  Sample email: ${sampleWithEmail.email}`);
              
              // Try to find the target user
              const targetEmail = "patrik@makeablesthlm.se";
              const testUser = await database.collection(coll.name).findOne({ email: targetEmail });
              
              if (testUser) {
                console.log(`  ✅ Found user with email: ${targetEmail}`);
                console.log(`  User fields: ${Object.keys(testUser).join(', ')}`);
                console.log(`\n*** FOUND TARGET USER in database "${db.name}", collection "${coll.name}" ***`);
              }
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

checkDatabase().catch(console.error); 