import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { adminService } from '../../services/adminService'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Plus, Edit, Trash2, Shield } from 'lucide-react'

const isoControlSchema = z.object({
  control_id: z.string().min(1, 'Control ID is required (e.g., A.9.2.1)'),
  control_name: z.string().min(1, 'Control name is required'),
  department_id: z.string().min(1, 'Department is required'),
  compliance_framework_id: z.string().min(1, 'Compliance framework is required'),
})

const ISOControls = () => {
  const [controls, setControls] = useState([])
  const [departments, setDepartments] = useState([])
  const [frameworks, setFrameworks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingControl, setEditingControl] = useState(null)
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedFramework, setSelectedFramework] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm({
    resolver: zodResolver(isoControlSchema),
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedDepartment || selectedFramework) {
      loadControls(selectedDepartment || null, selectedFramework || null)
    } else {
      loadControls()
    }
  }, [selectedDepartment, selectedFramework])

  const loadData = async () => {
    try {
      const [controlsData, departmentsData, frameworksData] = await Promise.all([
        adminService.getISOControls(),
        adminService.getDepartments(),
        adminService.getComplianceFrameworks(true), // Only active frameworks
      ])
      setControls(controlsData)
      setDepartments(departmentsData)
      setFrameworks(frameworksData)
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadControls = async (departmentId = null, frameworkId = null) => {
    try {
      const data = await adminService.getISOControls(departmentId, frameworkId)
      setControls(data)
    } catch (error) {
      toast.error('Failed to load ISO controls')
    }
  }

  const onSubmit = async (data) => {
    try {
      if (editingControl) {
        await adminService.updateISOControl(editingControl.id, data)
        toast.success('Control updated successfully')
      } else {
        await adminService.createISOControl(data)
        toast.success('Control created successfully')
      }
      reset()
      setShowForm(false)
      setEditingControl(null)
      loadControls(selectedDepartment || null, selectedFramework || null)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save control')
    }
  }

  const handleEdit = (control) => {
    setEditingControl(control)
    setValue('control_id', control.control_id)
    setValue('control_name', control.control_name)
    setValue('department_id', control.department_id || control.department_id?._id || control.department_id?.id)
    setValue('compliance_framework_id', control.compliance_framework_id || control.compliance_framework_id?._id || control.compliance_framework_id?.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this control? All questions in this control will also be deleted.')) return

    try {
      await adminService.deleteISOControl(id)
      toast.success('Control deleted successfully')
      loadControls(selectedDepartment || null, selectedFramework || null)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete control')
    }
  }

  const getDepartmentName = (departmentId) => {
    const dept = departments.find((d) => d.id === departmentId)
    return dept?.name || 'Unknown'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-slate-300 dark:border-slate-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading...</p>
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
              <span className="material-icons-outlined text-2xl text-blue-400">security</span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">Control Management</h1>
              <p className="text-sm text-slate-400 mt-1">
                Create and manage controls for departments across compliance frameworks
              </p>
            </div>
          </div>
          <Button onClick={() => {
            setShowForm(!showForm)
            setEditingControl(null)
            reset()
          }} className="shrink-0 w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            {showForm ? 'Cancel' : 'Add Control'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filter by Department
          </label>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filter by Compliance Framework
          </label>
          <select
            value={selectedFramework}
            onChange={(e) => setSelectedFramework(e.target.value)}
            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="">All Frameworks</option>
            {frameworks.map((framework) => (
              <option key={framework.id || framework._id} value={framework.id || framework._id}>
                {framework.name} {framework.version ? `(${framework.version})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingControl ? 'Edit Control' : 'Create New Control'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Department *
                  </label>
                  <select
                    {...register('department_id')}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Compliance Framework *
                  </label>
                  <select
                    {...register('compliance_framework_id')}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="">Select a framework</option>
                    {frameworks.map((framework) => (
                      <option key={framework.id || framework._id} value={framework.id || framework._id}>
                        {framework.name} {framework.version ? `(${framework.version})` : ''}
                      </option>
                    ))}
                  </select>
                  {errors.compliance_framework_id && (
                    <p className="mt-1 text-sm text-red-600">{errors.compliance_framework_id.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Control ID <span className="text-gray-500">(e.g., A.9.2.1)</span>
                </label>
                <Input
                  {...register('control_id')}
                  placeholder="A.9.2.1"
                />
                {errors.control_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.control_id.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Control Name
                </label>
                <Input
                  {...register('control_name')}
                  placeholder="e.g., Access control"
                />
                {errors.control_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.control_name.message}</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  {editingControl ? 'Update' : 'Create'} Control
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setEditingControl(null)
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

      <div className="space-y-4">
        {controls.map((control) => (
          <Card key={control.id}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-600">
                      {getDepartmentName(control.department_id)}
                    </span>
                  </div>
                  <div className="mb-1">
                    <span className="font-semibold text-gray-900">{control.control_id}</span>
                    <span className="text-gray-500 mx-2">•</span>
                    <span className="text-gray-700">{control.control_name}</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(control)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(control.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {controls.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No ISO controls found. Create your first ISO control to get started.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default ISOControls

