'use client'

import { useState, useEffect } from 'react'

export default function Home() {
  const [collections, setCollections] = useState([])
  const [collection, setCollection] = useState('')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingCollections, setLoadingCollections] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [formData, setFormData] = useState({})
  const [formDataText, setFormDataText] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState(null)
  const [sortOrder, setSortOrder] = useState('asc')
  const [dbKey, setDbKey] = useState('primary')
  const [databases, setDatabases] = useState([])
  const [paginationData, setPaginationData] = useState(null)

  // Fetch available collections on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch database names
        const dbRes = await fetch('/api/databases')
        const dbResult = await dbRes.json()
        if (dbResult.success) {
          setDatabases(dbResult.data || [])
        }

        // Fetch collections for current database
        const res = await fetch(`/api/collections?db=${dbKey}`)
        const result = await res.json()
        if (result.success) {
          setCollections(result.data || [])
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoadingCollections(false)
      }
    }

    fetchData()
  }, [dbKey])

  // Fetch data when page size changes
  useEffect(() => {
    if (collection && data.length > 0) {
      setPaginationData(null) // Clear old pagination data
      handleFetchAll(1)
    }
  }, [pageSize, collection])

  const showNotification = (msg, type = 'success') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleFetchAll = async (page = 1) => {
    if (!collection) {
      showNotification('Please select a collection', 'error')
      return
    }
    setLoading(true)
    try {
      // Build sort parameter
      let sortParam = ''
      if (sortField) {
        const order = sortOrder === 'asc' ? 1 : -1
        sortParam = `&sort=${sortField}:${order}`
      }

      const res = await fetch(
        `/api/collections/${collection}?db=${dbKey}&page=${page}&limit=${pageSize}${sortParam}`
      )
      const result = await res.json()
      if (result.success) {
        // Handle new pagination response format
        const documents = result.data.data || []
        setData(documents)
        setPaginationData(result.data.pagination)
        setCurrentPage(page)
        showNotification(
          `Loaded ${documents.length} of ${result.data.pagination?.total || 0} records`
        )
      } else {
        showNotification(`Error: ${result.error}`, 'error')
      }
    } catch (error) {
      showNotification(`Error: ${error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (doc = null) => {
    if (doc) {
      setSelectedDoc(doc)
      const filteredData = Object.keys(doc)
        .filter((k) => k !== '_id')
        .reduce((acc, k) => {
          acc[k] = doc[k]
          return acc
        }, {})
      setFormData(filteredData)
      setFormDataText(JSON.stringify(filteredData, null, 2))
    } else {
      setSelectedDoc(null)
      setFormData({})
      setFormDataText('')
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedDoc(null)
    setFormData({})
    setFormDataText('')
  }

  const handleSaveDocument = async () => {
    if (Object.keys(formData).length === 0 || formDataText.trim() === '') {
      showNotification('Please enter data', 'error')
      return
    }

    setLoading(true)
    try {
      // Parse the textarea JSON
      let parsedData
      try {
        parsedData = JSON.parse(formDataText)
      } catch (e) {
        showNotification(`Invalid JSON: ${e.message}`, 'error')
        setLoading(false)
        return
      }

      // Remove _id if it exists (it's immutable and can't be updated)
      delete parsedData._id

      let res
      if (selectedDoc) {
        res = await fetch(`/api/collections/${collection}?db=${dbKey}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedDoc._id, ...parsedData }),
        })
      } else {
        res = await fetch(`/api/collections/${collection}?db=${dbKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsedData),
        })
      }

      const result = await res.json()
      if (result.success) {
        showNotification(selectedDoc ? 'Record updated' : 'Record created')
        handleCloseModal()
        handleFetchAll(currentPage)
      } else {
        showNotification(`Error: ${result.error}`, 'error')
      }
    } catch (error) {
      showNotification(`Error: ${error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return

    setLoading(true)
    try {
      const res = await fetch(`/api/collections/${collection}?id=${id}&db=${dbKey}`, {
        method: 'DELETE',
      })
      const result = await res.json()
      if (result.success) {
        showNotification('Record deleted')
        handleFetchAll(currentPage)
      } else {
        showNotification(`Error: ${result.error}`, 'error')
      }
    } catch (error) {
      showNotification(`Error: ${error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const getTableHeaders = (data) => {
    if (data.length === 0) return []
    const keys = Object.keys(data[0])
    return keys.filter((k) => k !== '_id').slice(0, 5)
  }

  const formatValue = (value) => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'object') return JSON.stringify(value).substring(0, 50) + '...'
    if (typeof value === 'string' && value.length > 50) return value.substring(0, 50) + '...'
    return String(value)
  }

  // Client-side search only (server-side filtering can be added later)
  const filteredData = data.filter((doc) => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return Object.values(doc).some((val) =>
      String(val).toLowerCase().includes(searchLower)
    )
  })

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
    handleFetchAll(1)
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-slate-300 ml-1">⇅</span>
    return sortOrder === 'asc' ? (
      <span className="text-blue-600 ml-1">↑</span>
    ) : (
      <span className="text-blue-600 ml-1">↓</span>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Notification */}
      {message && (
        <div
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-medium z-50 animate-slideIn ${
            messageType === 'success'
              ? 'bg-emerald-500'
              : 'bg-red-500'
          }`}
        >
          {message}
        </div>
      )}

      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-6 border-b border-slate-200">
            <h1 className="text-2xl font-bold text-slate-900">Collections</h1>
            <p className="text-xs text-slate-500 mt-1">MongoDB Manager</p>
          </div>

          <div className="p-4 border-b border-slate-200">
            <label className="text-xs font-semibold text-slate-700 block mb-2">Database:</label>
            <div className="flex flex-col gap-2">
              {databases.map((db) => (
                <button
                  key={db.key}
                  onClick={() => {
                    setDbKey(db.key)
                    setCollection('')
                    setData([])
                    setSearchTerm('')
                  }}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors text-left ${
                    dbKey === db.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <div className="font-semibold truncate">{db.name}</div>
                  <div className="text-xs opacity-75">{db.uri}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loadingCollections ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : collections.length === 0 ? (
              <p className="text-sm text-slate-500">No collections</p>
            ) : (
              <div className="space-y-2">
                {collections.map((col) => (
                  <button
                    key={col}
                    onClick={() => {
                      setCollection(col)
                      setData([])
                      setSearchTerm('')
                    }}
                    className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                      collection === col
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm truncate">{col}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-200">
            <button
              onClick={handleFetchAll}
              disabled={!collection || loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-white border-b border-slate-200 p-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">
                  {collection || 'Select a collection'}
                </h2>
                <p className="text-slate-500 mt-1">
                  {data.length} records
                </p>
              </div>
              {collection && (
                <button
                  onClick={() => handleOpenModal()}
                  className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 font-medium"
                >
                  + New Record
                </button>
              )}
            </div>
          </div>

          {/* Search and Table */}
          <div className="flex-1 overflow-hidden flex flex-col p-6">
            {collection ? (
              <>
                {/* Search Bar */}
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Table */}
                {data.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-slate-500 text-lg">No records yet</p>
                      <button
                        onClick={() => handleOpenModal()}
                        className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Create first record →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto bg-white rounded-lg border border-slate-200 flex flex-col">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 text-left font-semibold text-slate-700">
                            ID
                          </th>
                          {getTableHeaders(data).map((header) => (
                            <th
                              key={header}
                              className="px-6 py-4 text-left font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                              onClick={() => handleSort(header)}
                            >
                              <div className="flex items-center">
                                {header}
                                <SortIcon field={header} />
                              </div>
                            </th>
                          ))}
                          <th className="px-6 py-4 text-right font-semibold text-slate-700">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredData.map((doc) => (
                          <tr
                            key={doc._id}
                            className="hover:bg-blue-50 transition-colors"
                          >
                            <td
                              className="px-6 py-4 text-xs font-mono text-slate-600 cursor-pointer hover:text-blue-600"
                              onClick={() => handleOpenModal(doc)}
                            >
                              {doc._id.substring(0, 12)}...
                            </td>
                            {getTableHeaders(data).map((header) => (
                              <td
                                key={`${doc._id}-${header}`}
                                className="px-6 py-4 text-slate-700 cursor-pointer hover:text-blue-600"
                                onClick={() => handleOpenModal(doc)}
                              >
                                {formatValue(doc[header])}
                              </td>
                            ))}
                            <td className="px-6 py-4 text-right space-x-2">
                              <button
                                onClick={() => handleOpenModal(doc)}
                                className="text-blue-600 hover:text-blue-700 font-medium text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(doc._id)}
                                className="text-red-600 hover:text-red-700 font-medium text-xs"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                       </tbody>
                     </table>
                     
                     {/* Pagination Controls */}
                     <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <label className="text-sm text-slate-700">Records per page:</label>
                         <select
                           value={pageSize}
                           onChange={(e) => {
                             const newPageSize = Number(e.target.value)
                             setPageSize(newPageSize)
                             setCurrentPage(1)
                           }}
                           className="px-3 py-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                         >
                           <option value={10}>10</option>
                           <option value={25}>25</option>
                           <option value={50}>50</option>
                           <option value={100}>100</option>
                           <option value={500}>500</option>
                         </select>
                       </div>

                       <div className="text-sm text-slate-600">
                         {!paginationData || paginationData.total === 0
                           ? 'No records'
                           : `${Math.max(1, (paginationData.page - 1) * paginationData.limit + 1)}–${Math.min(paginationData.page * paginationData.limit, paginationData.total)} of ${paginationData.total}`}
                       </div>

                       <div className="flex gap-2">
                         <button
                           onClick={() => handleFetchAll(Math.max(1, currentPage - 1))}
                           disabled={!paginationData || currentPage === 1 || loading}
                           className="px-3 py-1 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                           ← Previous
                         </button>
                         <div className="flex items-center gap-1">
                           {paginationData &&
                             Array.from({ length: paginationData.pages }, (_, i) => i + 1)
                               .filter(
                                 (page) =>
                                   page === 1 ||
                                   page === paginationData.pages ||
                                   (page >= currentPage - 1 && page <= currentPage + 1)
                               )
                               .map((page, idx, arr) => (
                                 <div key={page}>
                                   {idx > 0 && arr[idx - 1] !== page - 1 && (
                                     <span className="text-slate-400 px-1">...</span>
                                   )}
                                   <button
                                     onClick={() => handleFetchAll(page)}
                                     disabled={loading}
                                     className={`px-3 py-1 rounded-lg text-sm ${
                                       currentPage === page
                                         ? 'bg-blue-600 text-white'
                                         : 'border border-slate-300 hover:bg-slate-50 disabled:opacity-50'
                                     }`}
                                   >
                                     {page}
                                   </button>
                                 </div>
                               ))}
                         </div>
                         <button
                           onClick={() => handleFetchAll(Math.min(paginationData?.pages || 1, currentPage + 1))}
                           disabled={!paginationData || currentPage === paginationData.pages || loading}
                           className="px-3 py-1 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                           Next →
                         </button>
                       </div>
                     </div>
                   </div>
                 )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-slate-500 text-lg">Select a collection to get started</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-96 overflow-y-auto">
            <div className="p-6 border-b border-slate-200 sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-slate-900">
                {selectedDoc ? 'Edit Record' : 'Create New Record'}
              </h3>
            </div>

            <div className="p-6">
              <textarea
                value={formDataText}
                onChange={(e) => setFormDataText(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm h-48 resize-none"
                placeholder='{"key": "value"}'
              />
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
              <button
                onClick={handleCloseModal}
                className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDocument}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
