import { CollectionHandler } from '@/lib/collectionHandler'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  try {
    const { collection } = params
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const dbKey = searchParams.get('db') || 'primary'
    
    // Pagination params
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || '10')))
    
    // Sorting param (format: "field:1" or "field:-1" for multiple: "field1:1,field2:-1")
    const sortParam = searchParams.get('sort')
    let sort = { _id: -1 }
    if (sortParam) {
      sort = {}
      sortParam.split(',').forEach((s) => {
        const [field, order] = s.split(':')
        sort[field.trim()] = parseInt(order) || -1
      })
    }
    
    // Filter param (JSON string)
    const filterParam = searchParams.get('filter')
    let filter = {}
    if (filterParam) {
      try {
        filter = JSON.parse(filterParam)
      } catch (e) {
        return NextResponse.json(
          { success: false, error: 'Invalid filter JSON' },
          { status: 400 }
        )
      }
    }
    
    // Projection param (JSON string, e.g., {"name": 1, "_id": 0})
    const projectionParam = searchParams.get('projection')
    let projection = null
    if (projectionParam) {
      try {
        projection = JSON.parse(projectionParam)
      } catch (e) {
        return NextResponse.json(
          { success: false, error: 'Invalid projection JSON' },
          { status: 400 }
        )
      }
    }

    const handler = new CollectionHandler(collection, dbKey)

    let result

    if (id) {
      result = await handler.findById(id)
    } else {
      // Use paginated find instead of findAll
      result = await handler.findPaginated({
        query: filter,
        page,
        limit,
        sort,
        projection,
      })
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request, { params }) {
  try {
    const { collection } = params
    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const dbKey = searchParams.get('db') || 'primary'

    const handler = new CollectionHandler(collection, dbKey)
    const result = await handler.create(body)

    return NextResponse.json(
      { success: true, data: result },
      { status: 201 }
    )
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request, { params }) {
  try {
    const { collection } = params
    const body = await request.json()
    const { id, ...data } = body
    const { searchParams } = new URL(request.url)
    const dbKey = searchParams.get('db') || 'primary'

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required for update' },
        { status: 400 }
      )
    }

    const handler = new CollectionHandler(collection, dbKey)
    const result = await handler.updateById(id, data)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request, { params }) {
  try {
    const { collection } = params
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const dbKey = searchParams.get('db') || 'primary'

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required for deletion' },
        { status: 400 }
      )
    }

    const handler = new CollectionHandler(collection, dbKey)
    const success = await handler.deleteById(id)

    return NextResponse.json({
      success,
      message: success ? 'Document deleted' : 'Document not found',
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
