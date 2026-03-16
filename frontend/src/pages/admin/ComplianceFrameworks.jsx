import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { adminService } from '../../services/adminService'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Plus, Edit, Trash2, Shield, CheckCircle2, XCircle } from 'lucide-react'

const frameworkSchema = z.object({
  name: z.string().min(1, 'Framework name is required'),
  description: z.string().optional(),
  version: z.string().optional(),
  is_active: z.boolean().optional(),
})

const ComplianceFrameworks = () => {
  const [frameworks, setFrameworks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingFramework, setEditingFramework] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm({
    resolver: zodResolver(frameworkSchema),
    defaultValues: {
      is_active: true,
    },
  })

  useEffect(() => {
    loadFrameworks()
  }, [])

  const loadFrameworks = async () => {
    try {
      const data = await adminService.getComplianceFrameworks()
      setFrameworks(data)
    } catch (error) {
      toast.error('Failed to load compliance frameworks')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingFramework(null)
    reset({
      name: '',
      description: '',
      version: '',
      is_active: true,
    })
    setShowForm(true)
  }

  const handleEdit = (framework) => {
    setEditingFramework(framework)
    setValue('name', framework.name || '')
    setValue('description', framework.description || '')
    setValue('version', framework.version || '')
    setValue('is_active', framework.is_active !== false)
    setShowForm(true)
  }

  const onSubmit = async (data) => {
    // Coerce is_active to boolean (select sends "true"/"false" strings)
    const payload = {
      ...data,
      is_active: data.is_active === true || data.is_active === 'true',
    }
    try {
      if (editingFramework) {
        await adminService.updateComplianceFramework(editingFramework.id || editingFramework._id, payload)
        toast.success('Compliance framework updated successfully')
      } else {
        await adminService.createComplianceFramework(payload)
        toast.success('Compliance framework created successfully')
      }
      setShowForm(false)
      reset()
      loadFrameworks()
    } catch (error) {
      const detail = error.response?.data?.detail
      const message = Array.isArray(detail)
        ? detail.map((e) => e.msg || e.loc?.join('.')).join(', ')
        : typeof detail === 'string'
          ? detail
          : 'Failed to save compliance framework'
      toast.error(message)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this compliance framework? This action cannot be undone if controls are using it.')) {
      return
    }

    try {
      await adminService.deleteComplianceFramework(id)
      toast.success('Compliance framework deleted successfully')
      loadFrameworks()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete compliance framework')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-slate-300 dark:border-slate-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading compliance frameworks...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-hero">
        <div className="absolute inset-0 data-grid-pattern opacity-50" />
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-white/20 shrink-0">
              <span className="material-icons-outlined text-2xl text-blue-400">verified</span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">Compliance Frameworks</h1>
              <p className="text-sm text-slate-400 mt-1">
                Manage compliance frameworks (ISO 27001, SOC 2, GDPR, etc.)
              </p>
            </div>
          </div>
          <Button onClick={handleCreate} className="shrink-0 w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Add Framework
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader className="bg-slate-50/80 dark:bg-slate-800/50">
            <CardTitle className="text-2xl">
              {editingFramework ? 'Edit Compliance Framework' : 'Create Compliance Framework'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Framework Name *
                </label>
                <Input
                  {...register('name')}
                  placeholder="e.g., ISO 27001, SOC 2, GDPR"
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  {...register('description')}
                  placeholder="Brief description of the compliance framework"
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Version
                  </label>
                  <Input
                    {...register('version')}
                    placeholder="e.g., 2022, Type II"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <select
                    {...register('is_active', { valueAsNumber: false })}
                    className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    reset()
                  }}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {editingFramework ? 'Update' : 'Create'} Framework
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-xl animate-slide-in-up">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <CardTitle>Compliance Frameworks</CardTitle>
            <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm font-bold">
              {frameworks.length} {frameworks.length === 1 ? 'Framework' : 'Frameworks'}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {frameworks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {frameworks.map((framework, index) => (
                <div
                  key={framework.id || framework._id}
                  className="p-5 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 animate-slide-in-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                        {framework.name}
                      </h3>
                      {framework.version && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Version: {framework.version}
                        </p>
                      )}
                      {framework.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {framework.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        {framework.is_active !== false ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300">
                            <XCircle className="w-3 h-3" />
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(framework)}
                        className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                        title="Edit framework"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(framework.id || framework._id)}
                        className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        title="Delete framework"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 font-medium text-lg mb-2">No compliance frameworks</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">Create your first compliance framework to get started</p>
              <Button
                onClick={handleCreate}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Framework
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ComplianceFrameworks
