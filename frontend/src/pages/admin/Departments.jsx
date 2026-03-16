import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { adminService } from '../../services/adminService'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Dropdown, DropdownItem } from '../../components/ui/Dropdown'

const departmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  compliance_framework_ids: z.array(z.string()).optional(),
})

const isoControlSchema = z.object({
  control_id: z.string().min(1, 'Control ID is required (e.g., A.9.2.1)'),
  control_name: z.string().min(1, 'Control name is required'),
})

const Departments = () => {
  const [departments, setDepartments] = useState([])
  const [frameworks, setFrameworks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState(null)
  const [showControlForm, setShowControlForm] = useState(false)
  const [selectedDepartmentForControl, setSelectedDepartmentForControl] = useState(null)
  const [selectedFrameworks, setSelectedFrameworks] = useState([])

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      compliance_framework_ids: [],
    },
  })

  const {
    register: registerControl,
    handleSubmit: handleSubmitControl,
    formState: { errors: controlErrors },
    reset: resetControl,
  } = useForm({
    resolver: zodResolver(isoControlSchema),
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [departmentsData, frameworksData] = await Promise.all([
        adminService.getDepartments(),
        adminService.getComplianceFrameworks(true), // Only active frameworks
      ])
      setDepartments(departmentsData)
      setFrameworks(frameworksData)
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadDepartments = async () => {
    try {
      const data = await adminService.getDepartments()
      setDepartments(data)
    } catch (error) {
      toast.error('Failed to load departments')
    }
  }

  const onSubmit = async (data) => {
    try {
      const payload = {
        name: data.name,
        compliance_framework_ids: selectedFrameworks.map(id => id),
      }
      
      if (editingDepartment) {
        await adminService.updateDepartment(editingDepartment.id || editingDepartment._id, payload)
        toast.success('Department updated successfully')
      } else {
        await adminService.createDepartment(payload)
        toast.success('Department created successfully')
      }
      
      reset()
      setSelectedFrameworks([])
      setEditingDepartment(null)
      setShowForm(false)
      loadDepartments()
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${editingDepartment ? 'update' : 'create'} department`)
    }
  }

  const handleEdit = (department) => {
    setEditingDepartment(department)
    setValue('name', department.name)
    const frameworkIds = department.compliance_framework_ids || []
    setSelectedFrameworks(frameworkIds.map(id => id.toString()))
    setShowForm(true)
  }

  const handleCreate = () => {
    setEditingDepartment(null)
    reset()
    setSelectedFrameworks([])
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!id) {
      console.error('Delete called with invalid ID:', id)
      toast.error('Invalid department ID')
      return
    }

    if (!window.confirm('Are you sure you want to delete this department? This action cannot be undone.')) return

    try {
      await adminService.deleteDepartment(id)
      toast.success('Department deleted successfully')
      loadDepartments()
    } catch (error) {
      console.error('Delete department error:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to delete department'
      toast.error(errorMessage)
    }
  }

  const handleClearResponses = async (department) => {
    const confirmMessage = `Are you sure you want to clear all responses (control-wise) for "${department.name}"?\n\nThis will delete:\n- All control responses\n- All question responses\n\nThis action cannot be undone.`
    if (!window.confirm(confirmMessage)) return

    try {
      const result = await adminService.clearDepartmentResponses(department.id)
      toast.success(
        `Cleared ${result.control_responses_deleted} control responses and ${result.question_responses_deleted} question responses for ${department.name}`
      )
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to clear responses')
    }
  }

  const handleAddControl = (department) => {
    setSelectedDepartmentForControl(department)
    setShowControlForm(true)
    resetControl()
  }

  const onSubmitControl = async (data) => {
    try {
      await adminService.createISOControl({
        ...data,
        department_id: selectedDepartmentForControl.id
      })
      toast.success('Control created successfully')
      resetControl()
      setShowControlForm(false)
      setSelectedDepartmentForControl(null)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create control')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-slate-300 dark:border-slate-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading departments...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8 animate-fade-in">
      <div className="page-hero">
        <div className="absolute inset-0 data-grid-pattern opacity-50" />
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full" />
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-white/20 shrink-0">
              <span className="material-icons-outlined text-2xl text-blue-400">business</span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white tracking-tight">
                Department Management
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Create and manage departments (e.g., IT, HR, Finance, Operations)
              </p>
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold rounded-xl transition-all shrink-0 w-full sm:w-auto justify-center"
          >
            <span className="material-icons-outlined text-lg">add</span>
            <span>Add Department</span>
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card className="animate-scale-in">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700 p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white min-w-0 flex-1">
                {editingDepartment ? 'Edit Department' : 'Create New Department'}
              </CardTitle>
              <button
                onClick={() => {
                  setShowForm(false)
                  reset()
                  setSelectedFrameworks([])
                  setEditingDepartment(null)
                }}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Department Name <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">business</span>
                  <Input
                    {...register('name')}
                    placeholder="e.g., IT, HR, Finance, Operations"
                    className="pl-10 w-full"
                  />
                </div>
                {errors.name && (
                  <p className="mt-1 text-sm text-red-500 font-medium">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Compliance Frameworks
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Tick one or more frameworks to assign this department to multiple frameworks (optional).
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/50">
                  {frameworks.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                      No compliance frameworks available. Create frameworks first.
                    </p>
                  ) : (
                    frameworks.map((framework) => {
                      const frameworkId = (framework.id || framework._id).toString()
                      const isSelected = selectedFrameworks.includes(frameworkId)
                      return (
                        <label
                          key={frameworkId}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2 ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                          }`}
                        >
                          <span className="flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                            {isSelected ? (
                              <span className="material-icons-outlined text-blue-600 dark:text-blue-400 text-base leading-none">check</span>
                            ) : null}
                          </span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedFrameworks([...selectedFrameworks, frameworkId])
                              } else {
                                setSelectedFrameworks(selectedFrameworks.filter(id => id !== frameworkId))
                              }
                            }}
                            className="sr-only"
                            aria-label={`Assign to ${framework.name}`}
                          />
                          <span className="material-icons-outlined text-slate-400">verified</span>
                          <div className="flex-1">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {framework.name}
                            </span>
                            {framework.version && (
                              <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
                                ({framework.version})
                              </span>
                            )}
                          </div>
                        </label>
                      )
                    })
                  )}
                </div>
                {selectedFrameworks.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 w-full">Selected: </span>
                    {selectedFrameworks.map((frameworkId) => {
                      const framework = frameworks.find(f => (f.id || f._id).toString() === frameworkId)
                      if (!framework) return null
                      return (
                        <span
                          key={frameworkId}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50"
                        >
                          <span className="material-icons-outlined text-sm">check_circle</span>
                          {framework.name}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFrameworks(selectedFrameworks.filter(id => id !== frameworkId))
                            }}
                            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            aria-label={`Remove ${framework.name}`}
                          >
                            <span className="material-icons-outlined text-sm">close</span>
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-primary hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                >
                  <span className="material-icons-outlined text-lg">
                    {editingDepartment ? 'save' : 'add'}
                  </span>
                  <span>{editingDepartment ? 'Update Department' : 'Create Department'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    reset()
                    setSelectedFrameworks([])
                    setEditingDepartment(null)
                  }}
                  className="px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Departments Grid */}
      <div>
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white mb-2">All Departments</h2>
          <p className="text-slate-600 dark:text-slate-400">Manage your organization's departments and their compliance frameworks</p>
        </div>

        {departments.length === 0 ? (
          <Card className="animate-scale-in border-0 shadow-lg">
            <CardContent className="py-16 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                  <span className="material-icons-outlined text-4xl text-blue-600 dark:text-blue-400">business</span>
                </div>
                <p className="text-slate-900 dark:text-white font-semibold text-lg">No departments found</p>
                <p className="text-slate-600 dark:text-slate-400 text-sm max-w-md">
                  Create your first department to get started with compliance management
                </p>
                <button
                  onClick={handleCreate}
                  className="mt-2 px-6 py-3 bg-primary hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
                >
                  <span className="material-icons-outlined">add</span>
                  <span>Create Department</span>
                </button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept, index) => {
              const deptId = dept.id
              if (!deptId) {
                console.error('Department missing ID:', dept)
                return null
              }
              return (
                <Card 
                  key={deptId} 
                  hover={true}
                  className="animate-slide-in-up border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white dark:bg-slate-800"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg flex-shrink-0">
                        <span className="material-icons-outlined text-white text-xl">business</span>
                      </div>
                      <CardTitle className="text-lg font-bold text-slate-900 dark:text-white break-words">
                        {dept.name}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {/* Compliance Frameworks */}
                    {dept.compliance_framework_ids && dept.compliance_framework_ids.length > 0 ? (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1">
                          <span className="material-icons-outlined text-sm">verified</span>
                          Compliance Frameworks:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {dept.compliance_framework_ids.map((frameworkId) => {
                            const framework = frameworks.find(f => (f.id || f._id).toString() === frameworkId.toString())
                            if (!framework) return null
                            return (
                              <span
                                key={frameworkId}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50"
                              >
                                <span className="material-icons-outlined text-sm">shield</span>
                                {framework.name}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic flex items-center gap-1.5">
                          <span className="material-icons-outlined text-sm">info</span>
                          No compliance frameworks assigned
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => handleEdit(dept)}
                        className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                        title="Edit Department"
                      >
                        <span className="material-icons-outlined text-lg">edit</span>
                        <span className="text-sm">Edit</span>
                      </button>
                      <Dropdown>
                        <button className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors">
                          <span className="material-icons-outlined">more_vert</span>
                        </button>
                        <DropdownItem onClick={() => handleAddControl(dept)}>
                          <div className="flex items-center gap-2">
                            <span className="material-icons-outlined text-lg">security</span>
                            <span>Add Controls</span>
                          </div>
                        </DropdownItem>
                        <DropdownItem onClick={() => handleClearResponses(dept)}>
                          <div className="flex items-center gap-2 text-orange-600">
                            <span className="material-icons-outlined text-lg">refresh</span>
                            <span>Clear Responses</span>
                          </div>
                        </DropdownItem>
                      </Dropdown>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleDelete(deptId)
                        }}
                        className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                        title="Delete Department"
                      >
                        <span className="material-icons-outlined">delete</span>
                      </button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Control Modal */}
      {showControlForm && selectedDepartmentForControl && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-slate-700 animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Add Control
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  to {selectedDepartmentForControl.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowControlForm(false)
                  setSelectedDepartmentForControl(null)
                  resetControl()
                }}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmitControl(onSubmitControl)} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Control ID <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">tag</span>
                  <Input
                    {...registerControl('control_id')}
                    placeholder="e.g., A.9.2.1"
                    className="pl-10 w-full"
                  />
                </div>
                {controlErrors.control_id && (
                  <p className="mt-1 text-sm text-red-500 font-medium">{controlErrors.control_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Control Name <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">description</span>
                  <Input
                    {...registerControl('control_name')}
                    placeholder="e.g., Access control"
                    className="pl-10 w-full"
                  />
                </div>
                {controlErrors.control_name && (
                  <p className="mt-1 text-sm text-red-500 font-medium">{controlErrors.control_name.message}</p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-primary hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                >
                  <span className="material-icons-outlined">add</span>
                  <span>Create Control</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowControlForm(false)
                    setSelectedDepartmentForControl(null)
                    resetControl()
                  }}
                  className="px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Departments
