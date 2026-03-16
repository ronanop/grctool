import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { adminService } from '../../services/adminService'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Plus, Trash2, FileText, Upload, Search, Building2, Filter, FileCheck } from 'lucide-react'

const documentSchema = z.object({
  file: z.instanceof(FileList).refine(files => files.length > 0, 'PDF file is required'),
  department_id: z.string().min(1, 'Department is required'),
  document_name: z.string().optional(),
})

const RAGDocuments = () => {
  const [documents, setDocuments] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm({
    resolver: zodResolver(documentSchema),
  })

  const selectedFile = watch('file')

  useEffect(() => {
    loadDepartments()
    loadDocuments()
  }, [])

  useEffect(() => {
    loadDocuments()
  }, [selectedDepartment])

  const loadDepartments = async () => {
    try {
      const data = await adminService.getDepartments()
      setDepartments(data || [])
    } catch (error) {
      console.error('Error loading departments:', error)
    }
  }

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const departmentId = selectedDepartment !== 'all' ? selectedDepartment : null
      const data = await adminService.getRAGDocuments(departmentId)
      setDocuments(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading documents:', error)
      // Only show error toast if it's not a network/CORS error (those are handled by axios interceptor)
      if (error.response) {
        toast.error(error.response?.data?.detail || 'Failed to load documents')
      }
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data) => {
    try {
      setUploading(true)
      const file = data.file[0]
      await adminService.uploadRAGDocument(
        file,
        data.department_id,
        data.document_name || file.name
      )
      toast.success('Document uploaded and processed successfully!')
      reset()
      setShowForm(false)
      loadDocuments()
    } catch (error) {
      const detail = error.response?.data?.detail
      const msg = Array.isArray(detail) ? detail.join(' ') : (detail || error.message || 'Failed to upload document')
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document and all its chunks?')) return

    try {
      await adminService.deleteRAGDocument(documentId)
      toast.success('Document deleted successfully')
      loadDocuments()
    } catch (error) {
      toast.error('Failed to delete document')
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }

    try {
      const departmentId = selectedDepartment !== 'all' ? selectedDepartment : null
      const results = await adminService.searchRAGDocuments(searchQuery, departmentId, 5)
      setSearchResults(results)
      toast.success(`Found ${results.count} relevant chunks`)
    } catch (error) {
      toast.error('Search failed')
      setSearchResults(null)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(2)} MB`
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div className="page-hero">
        <div className="absolute inset-0 data-grid-pattern opacity-50" />
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-white/20 shrink-0">
              <span className="material-icons-outlined text-2xl text-blue-400">menu_book</span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">RAG Documents</h1>
              <p className="text-sm text-slate-400 mt-1">
                Upload PDFs per department. Chunked and stored in Pinecone for AI-powered semantic search.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowForm(!showForm)} size="lg" className="shrink-0 w-full sm:w-auto">
            <Plus className="w-5 h-5 mr-2" />
            {showForm ? 'Cancel' : 'Upload Document'}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Upload PDF Document</CardTitle>
            <p className="text-sm text-gray-500 mt-1">PDFs are chunked and embedded into Pinecone for retrieval.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('department_id')}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Select a department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                {errors.department_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.department_id.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PDF File <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    <FileText className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                      >
                        <span>Upload a file</span>
                        <input
                          id="file-upload"
                          type="file"
                          accept=".pdf"
                          {...register('file')}
                          className="sr-only"
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">PDF up to 50MB</p>
                    {selectedFile && selectedFile[0] && (
                      <p className="text-sm text-gray-900 mt-2">
                        Selected: {selectedFile[0].name}
                      </p>
                    )}
                  </div>
                </div>
                {errors.file && (
                  <p className="mt-1 text-sm text-red-600">{errors.file.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Name (Optional)
                </label>
                <Input
                  {...register('document_name')}
                  placeholder="Leave empty to use filename"
                />
                <p className="mt-1 text-xs text-gray-500">
                  A friendly name for this document (defaults to filename)
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={uploading}>
                  {uploading ? (
                    <>
                      <Upload className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload & Process
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    reset()
                    setShowForm(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle>Search Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for information in documents..."
              className="flex-1"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
          {searchResults && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-gray-600">
                Found {searchResults.count} relevant chunks in {searchResults.department_id ? 'selected' : 'all'} departments
              </p>
              {searchResults.results.map((result, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate flex-1 min-w-0" title={result.metadata?.document_name || 'Document'}>
                      {result.metadata?.document_name || 'Document'}
                    </span>
                    {result.distance && (
                      <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0 ml-2">
                        Relevance: {(1 - result.distance).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 break-words">{result.text}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-500" />
          <label className="text-sm font-medium text-gray-700">Filter by Department:</label>
        </div>
        <select
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        >
          <option value="all">All Departments</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {documents.map((doc) => {
          const department = departments.find(d => d.id === doc.department_id || d.id === doc.department_id?._id || d.id === doc.department_id?.id)
          return (
            <Card key={doc.document_id || doc.id} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileCheck className="w-8 h-8 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {department && (
                          <>
                            <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <span className="text-xs font-medium text-gray-500 truncate max-w-[120px]">
                              {department.name}
                            </span>
                          </>
                        )}
                        <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 whitespace-nowrap flex-shrink-0">
                          {doc.chunks_count || 0} chunks
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 truncate" title={doc.name}>
                        {doc.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 truncate" title={doc.original_filename}>
                        {doc.original_filename}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex-shrink-0">Size:</span>
                    <span className="text-right truncate">{formatFileSize(doc.file_size)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex-shrink-0">Uploaded:</span>
                    <span className="text-right text-xs truncate" title={formatDate(doc.uploaded_at)}>
                      {formatDate(doc.uploaded_at)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDelete(doc.document_id || doc.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {documents.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No documents uploaded yet. Upload your first PDF to chunk and index in Pinecone for RAG search.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default RAGDocuments

