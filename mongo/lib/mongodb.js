import { MongoClient } from 'mongodb'

let cachedClients = {
  primary: { client: null, db: null },
  secondary: { client: null, db: null },
}

export async function connectToDatabase(dbKey = 'primary') {
  const uriKey = dbKey === 'primary' ? 'MONGODB_URI' : 'MONGODB_URI_SECOND'
  const dbNameKey = dbKey === 'primary' ? 'MONGODB_DB' : 'MONGODB_DB_SECOND'

  if (cachedClients[dbKey].client && cachedClients[dbKey].db) {
    return {
      client: cachedClients[dbKey].client,
      db: cachedClients[dbKey].db,
    }
  }

  if (!process.env[uriKey]) {
    throw new Error(`Please define the ${uriKey} environment variable`)
  }

  if (!process.env[dbNameKey]) {
    throw new Error(`Please define the ${dbNameKey} environment variable`)
  }

  const client = new MongoClient(process.env[uriKey])

  try {
    await client.connect()
    const db = client.db(process.env[dbNameKey])

    cachedClients[dbKey] = { client, db }

    return { client, db }
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error)
    throw error
  }
}

export async function getCollection(collectionName, dbKey = 'primary') {
  const { db } = await connectToDatabase(dbKey)
  return db.collection(collectionName)
}
