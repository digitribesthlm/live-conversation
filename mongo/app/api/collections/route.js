import { connectToDatabase } from '@/lib/mongodb'
import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const dbKey = searchParams.get('db') || 'primary'

    const { db } = await connectToDatabase(dbKey)

    // Get all collections from the database
    const collections = await db.listCollections().toArray()

    // Extract collection names
    const collectionNames = collections
      .map((col) => col.name)
      .filter((name) => !name.startsWith('system.'))

    return NextResponse.json({
      success: true,
      data: collectionNames.sort(),
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
