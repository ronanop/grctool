import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { adminService } from '../../services/adminService'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Plus, Trash2, FileText, Download, Upload, Building2, Filter, Folder } from 'lucide-react'

const policySchema = z.object({
  name: z.string().min(1, 'Policy name is required'),
  description: z.string().optional(),
  department_id: z.string().min(1, 'Department is required'),
})

const Policies = () => {
  const [policies, setPolicies] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState('all')

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(policySchema),
  })

  useEffect(() => {
    loadDepartments()
    loadPolicies()
  }, [])

  useEffect(() => {
    loadPolicies()
  }, [selectedDepartment])

  const loadDepartments = async () => {
    try {
      const data = await adminService.getDepartments()
      setDepartments(data || [])
    } catch (error) {
      console.error('Error loading departments:', error)
    }
  }

  const loadPolicies = async () => {
    try {
      const params = selectedDepartment !== 'all' ? { department_id: selectedDepartment } : {}
      const data = await adminService.getPolicies(params)
      setPolicies(data || [])
    } catch (error) {
      console.error('Error loading policies:', error)
      toast.error(error.response?.data?.detail || 'Failed to load policies')
      setPolicies([])
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data) => {
    const fileInput = document.getElementById('policy-file')
    const file = fileInput?.files[0]

    if (!file) {
      toast.error('Please select a file to upload')
      return
    }

    if (!data.department_id) {
      toast.error('Please select a department')
      return
    }

    // Validate file size (50MB max)
    const MAX_FILE_SIZE = 50 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size exceeds 50MB limit')
      return
    }

    // Validate file type
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.pptx', '.ppt']
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase()
    if (!allowedExtensions.includes(fileExtension)) {
      toast.error('File type not supported. Please upload PDF, DOC, DOCX, TXT, XLS, XLSX, PPT, or PPTX files.')
      return
    }

    setUploading(true)
    try {
      await adminService.uploadPolicy(file, data.name, data.description, data.department_id)
      toast.success('Policy uploaded successfully')
      reset()
      setShowForm(false)
      loadPolicies()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload policy')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this policy?')) return

    try {
      await adminService.deletePolicy(id)
      toast.success('Policy deleted successfully')
      loadPolicies()
    } catch (error) {
      toast.error('Failed to delete policy')
    }
  }

  const handleDownload = async (policy) => {
    try {
      const blob = await adminService.downloadPolicy(policy.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = policy.file_name || 'policy.pdf'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      toast.error('Failed to download policy')
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
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

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">Policy Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Upload and manage organizational policies
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" />
          {showForm ? 'Cancel' : 'Upload Policy'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Upload New Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Folder className="w-4 h-4 inline mr-1" />
                  Folder (Department) <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('department_id')}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Select a folder/department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      📁 {dept.name}
                    </option>
                  ))}
                </select>
                {errors.department_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.department_id.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Select the folder (department) where this policy will be stored. The folder name matches the department name.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Policy Name <span className="text-red-500">*</span>
                </label>
                <Input
                  {...register('name')}
                  placeholder="e.g., Information Security Policy"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  {...register('description')}
                  rows={3}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Brief description of the policy..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Policy File <span className="text-red-500">*</span>
                </label>
                <input
                  id="policy-file"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.pptx,.ppt"
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  onChange={(e) => {
                    const file = e.target.files[0]
                    if (file) {
                      // File selected, validation happens on submit
                    }
                  }}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Accepted formats: PDF, DOC, DOCX, TXT, XLS, XLSX, PPT, PPTX (Max 50MB)
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={uploading}>
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload Policy'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    reset()
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {policies.map((policy) => {
          const department = departments.find(d => d.id === policy.department_id || d.id === policy.department_id?._id || d.id === policy.department_id?.id)
          return (
            <Card key={policy.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="w-8 h-8 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-gray-500" />
                        <span className="text-xs font-medium text-gray-500">
                          {department?.name || 'Unknown Department'}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 truncate">{policy.name}</h3>
                      {policy.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{policy.description}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(policy.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>File:</span>
                    <span className="font-medium truncate ml-2">{policy.file_name}</span>
                  </div>
                <div className="flex items-center justify-between">
                  <span>Size:</span>
                  <span>{formatFileSize(policy.file_size)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Uploaded:</span>
                  <span>{formatDate(policy.uploaded_at)}</span>
                </div>
              </div>

              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleDownload(policy)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
          )
        })}

        {policies.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No policies found. Upload your first policy to get started.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default Policies

