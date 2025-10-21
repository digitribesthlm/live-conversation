import { getCollection } from './mongodb'
import { ObjectId } from 'mongodb'

export class CollectionHandler {
  constructor(collectionName, dbKey = 'primary') {
    this.collectionName = collectionName
    this.dbKey = dbKey
  }

  async getCollection() {
    return getCollection(this.collectionName, this.dbKey)
  }

  async findOne(query) {
    const collection = await this.getCollection()
    return collection.findOne(query)
  }

  async findAll(query = {}) {
    const collection = await this.getCollection()
    return collection.find(query).toArray()
  }

  async findById(id) {
    const collection = await this.getCollection()
    return collection.findOne({ _id: new ObjectId(id) })
  }

  async create(data) {
    const collection = await this.getCollection()
    const result = await collection.insertOne({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    return this.findById(result.insertedId.toString())
  }

  async updateOne(query, data) {
    const collection = await this.getCollection()
    await collection.updateOne(query, {
      $set: { ...data, updatedAt: new Date() },
    })
    return this.findOne(query)
  }

  async updateById(id, data) {
    const collection = await this.getCollection()
    await collection.updateOne({ _id: new ObjectId(id) }, {
      $set: { ...data, updatedAt: new Date() },
    })
    return this.findById(id)
  }

  async deleteOne(query) {
    const collection = await this.getCollection()
    const result = await collection.deleteOne(query)
    return result.deletedCount > 0
  }

  async deleteById(id) {
    const collection = await this.getCollection()
    const result = await collection.deleteOne({ _id: new ObjectId(id) })
    return result.deletedCount > 0
  }

  async count(query = {}) {
    const collection = await this.getCollection()
    return collection.countDocuments(query)
  }

  // NEW: Paginated find with support for filtering, sorting, and field projection
  async findPaginated(options = {}) {
    const {
      query = {},
      page = 1,
      limit = 10,
      sort = { _id: -1 },
      projection = null,
    } = options

    if (page < 1 || limit < 1) {
      throw new Error('Page and limit must be greater than 0')
    }

    if (limit > 1000) {
      throw new Error('Limit cannot exceed 1000 documents per page')
    }

    const collection = await this.getCollection()
    const skip = (page - 1) * limit

    // Build query
    let findQuery = collection.find(query)

    // Apply projection if specified
    if (projection) {
      findQuery = findQuery.project(projection)
    }

    // Apply sorting
    if (sort) {
      findQuery = findQuery.sort(sort)
    }

    // Get total count for pagination metadata
    const total = await collection.countDocuments(query)

    // Apply pagination
    const data = await findQuery.skip(skip).limit(limit).toArray()

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    }
  }

  // NEW: Find with a limit (for simple cases)
  async findWithLimit(query = {}, limit = 100, sort = { _id: -1 }) {
    if (limit > 10000) {
      throw new Error('Limit cannot exceed 10000 documents')
    }

    const collection = await this.getCollection()
    return collection.find(query).sort(sort).limit(limit).toArray()
  }

  // NEW: Stream large datasets (useful for exports)
  async findStream(query = {}, sort = { _id: -1 }) {
    const collection = await this.getCollection()
    return collection.find(query).sort(sort).stream()
  }

  // NEW: Search with text index (requires text index on collection)
  async search(searchText, query = {}, limit = 50) {
    if (limit > 10000) {
      throw new Error('Limit cannot exceed 10000 documents')
    }

    const collection = await this.getCollection()
    return collection
      .find({ ...query, $text: { $search: searchText } })
      .limit(limit)
      .toArray()
  }
}
