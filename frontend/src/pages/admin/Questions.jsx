import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { adminService } from '../../services/adminService'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Plus, Edit, Trash2, Shield, Upload, Download, FileSpreadsheet } from 'lucide-react'

const questionSchema = z.object({
  text: z.string().min(1, 'Question text is required'),
  control_name: z.string().min(1, 'Control name is required'),
  control_id: z.string().min(1, 'Control ID is required (e.g., A.9.2.1)'),
  department_id: z.string().min(1, 'Department is required'),
  compliance_framework_id: z.string().min(1, 'Compliance framework is required'),
}).refine((data) => {
  // If both are selected from dropdown, they should match
  // But allow manual entry if needed
  return true
}, {
  message: "Control ID and Control Name must match",
})

const Questions = () => {
  const [questions, setQuestions] = useState([])
  const [isoControls, setISOControls] = useState([])
  const [departments, setDepartments] = useState([])
  const [frameworks, setFrameworks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedISOControl, setSelectedISOControl] = useState('')
  const [selectedFramework, setSelectedFramework] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(questionSchema),
  })

  const selectedDeptId = watch('department_id')
  const formDepartmentId = watch('department_id')

  useEffect(() => {
    loadData()
  }, [])

  // Watch department_id from form to load ISO controls
  useEffect(() => {
    if (formDepartmentId) {
      loadISOControls(formDepartmentId)
      setSelectedDepartment(formDepartmentId)
    }
  }, [formDepartmentId])

  useEffect(() => {
    if (selectedDepartment || selectedFramework) {
      loadISOControls(selectedDepartment || null, selectedFramework || null)
      loadQuestions(null, selectedDepartment || null, selectedFramework || null)
    } else {
      loadISOControls()
      loadQuestions()
    }
  }, [selectedDepartment, selectedFramework])

  useEffect(() => {
    if (selectedISOControl) {
      loadQuestions(selectedISOControl, selectedDepartment || null, selectedFramework || null)
    } else if (selectedDepartment || selectedFramework) {
      loadQuestions(null, selectedDepartment || null, selectedFramework || null)
    } else {
      loadQuestions()
    }
  }, [selectedISOControl])

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

  const loadISOControls = async (departmentId = null, frameworkId = null) => {
    try {
      const data = await adminService.getISOControls(departmentId, frameworkId)
      setISOControls(data)
      return data
    } catch (error) {
      toast.error('Failed to load ISO controls')
      return []
    }
  }

  const loadQuestions = async (isoControlId = null, departmentId = null, frameworkId = null) => {
    try {
      const data = await adminService.getQuestions(isoControlId, departmentId, frameworkId)
      setQuestions(data)
    } catch (error) {
      toast.error('Failed to load questions')
    }
  }

  const onSubmit = async (data, addAnother = false) => {
    try {
      if (editingQuestion) {
        await adminService.updateQuestion(editingQuestion.id, data)
        toast.success('Question updated successfully')
        reset()
        setShowForm(false)
        setEditingQuestion(null)
      } else {
        await adminService.createQuestion(data)
        toast.success('Question created successfully')
        
        if (addAnother) {
          // Keep department and control fields, only reset question text
          setValue('text', '')
          // Keep the form open with department and control pre-filled
        } else {
          reset()
          setShowForm(false)
        }
      }
      loadQuestions(selectedISOControl || null, selectedDepartment || null)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save question')
    }
  }

  const handleEdit = async (question) => {
    setEditingQuestion(question)
    setValue('text', question.text)
    // Find the ISO control to get control_id, control_name, department, and framework
    const control = isoControls.find(c => c.id === question.iso_control_id)
    if (control) {
      setValue('control_id', control.control_id)
      setValue('control_name', control.control_name)
      setValue('department_id', control.department_id || control.department_id?._id || control.department_id?.id)
      setValue('compliance_framework_id', control.compliance_framework_id || control.compliance_framework_id?._id || control.compliance_framework_id?.id)
      setSelectedDepartment(control.department_id || control.department_id?._id || control.department_id?.id)
      // Load ISO controls for the department and framework to populate dropdowns
      await loadISOControls(control.department_id || control.department_id?._id || control.department_id?.id, control.compliance_framework_id || control.compliance_framework_id?._id || control.compliance_framework_id?.id)
    }
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return

    try {
      await adminService.deleteQuestion(id)
      toast.success('Question deleted successfully')
      loadQuestions(selectedISOControl || null, selectedDepartment || null)
    } catch (error) {
      toast.error('Failed to delete question')
    }
  }

  const getISOControlInfo = (isoControlId) => {
    const control = isoControls.find((c) => c.id === isoControlId)
    return control ? `${control.control_id} - ${control.control_name}` : 'Unknown'
  }

  const downloadTemplate = () => {
    // Create Excel template
    const headers = ['compliance_framework', 'department', 'control_id', 'control_name', 'question_text', 'question_id']
    const exampleRows = [
      ['ISO 27001', 'IT', 'A.9.2.1', 'Access control', 'Do you have user access management procedures in place?', 'a'],
      ['ISO 27001', 'IT', 'A.9.2.1', 'Access control', 'Are user access rights reviewed regularly?', 'b'],
      ['SOC 2', 'IT', 'CC6.1', 'Logical access controls', 'Do you have logical access controls to protect against unauthorized access?', 'a'],
    ]
    
    // Create CSV content (simpler than Excel, but works)
    let csvContent = headers.join(',') + '\n'
    exampleRows.forEach(row => {
      csvContent += row.map(cell => `"${cell}"`).join(',') + '\n'
    })
    
    // Convert to Excel-like format or just provide CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'questions_import_template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast.success('Template downloaded! Note: For Excel format, rename .csv to .xlsx and open in Excel')
  }

  const handleBulkImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.xls,.csv'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('import_mode', 'create_only') // or get from user selection
      
      try {
        toast.loading('Importing questions...', { id: 'bulk-import' })
        const result = await adminService.bulkImportQuestions(file, 'create_only')
        
        toast.success(
          `Import completed! ${result.successful} question(s) saved to database, ${result.failed} failed, ${result.skipped} skipped. Data is permanently saved.`,
          { id: 'bulk-import', duration: 6000 }
        )
        
        if (result.errors && result.errors.length > 0) {
          console.error('Import errors:', result.errors)
          // Show first few errors
          const errorMessages = result.errors.slice(0, 3).map(e => `Row ${e.row}: ${e.error}`).join('; ')
          toast.error(`${result.errors.length} errors occurred. ${errorMessages}${result.errors.length > 3 ? '...' : ''}`, { duration: 8000 })
        }
        
        if (result.warnings && result.warnings.length > 0) {
          result.warnings.forEach(warning => {
            toast(warning, { icon: '⚠️', duration: 4000 })
          })
        }
        
        // Reload questions - clear filters to show all imported questions
        setSelectedISOControl('')
        setSelectedDepartment('')
        setSelectedFramework('')
        loadQuestions() // Load all questions to show imported ones
      } catch (error) {
        const errorMessage = error.response?.data?.detail || error.message || 'Failed to import questions'
        toast.error(`Import failed: ${errorMessage}`, { id: 'bulk-import', duration: 8000 })
        console.error('Bulk import error:', error)
      }
    }
    input.click()
  }

  const getQuestionDisplayId = (question) => {
    // Format: Control ID + Question ID (e.g., A.6.1.a)
    const control = isoControls.find((c) => c.id === question.iso_control_id)
    if (control && question.question_id) {
      return `${control.control_id}.${question.question_id}`
    }
    return question.question_id || ''
  }

  const getDepartmentName = (isoControlId) => {
    const control = isoControls.find((c) => c.id === isoControlId)
    if (!control) return 'Unknown'
    const dept = departments.find((d) => d.id === control.department_id)
    return dept?.name || 'Unknown'
  }

  // Filter ISO controls by selected department and framework (from form or filter)
  const activeDepartmentId = formDepartmentId || selectedDepartment
  const activeFrameworkId = watch('compliance_framework_id') || selectedFramework
  const filteredISOControls = isoControls.filter(c => {
    if (activeDepartmentId && c.department_id !== activeDepartmentId) return false
    if (activeFrameworkId && c.compliance_framework_id !== activeFrameworkId) return false
    return true
  })

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">Manage Questions</h1>
          <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            Create and manage questions for ISO 27001 controls
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            onClick={handleBulkImport}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            Bulk Import
          </Button>
          <Button
            onClick={downloadTemplate}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Template
          </Button>
          <Button onClick={() => {
            setShowForm(!showForm)
            setEditingQuestion(null)
            reset()
          }}>
            <Plus className="w-4 h-4 mr-2" />
            {showForm ? 'Cancel' : 'Add Question'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filter by Department
          </label>
          <select
            value={selectedDepartment}
            onChange={(e) => {
              setSelectedDepartment(e.target.value)
              setSelectedISOControl('')
            }}
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
            onChange={(e) => {
              setSelectedFramework(e.target.value)
              setSelectedISOControl('')
            }}
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
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filter by Control
          </label>
          <select
            value={selectedISOControl}
            onChange={(e) => setSelectedISOControl(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            disabled={!selectedDepartment && filteredISOControls.length === 0}
          >
            <option value="">All Controls</option>
            {filteredISOControls.map((control) => (
              <option key={control.id} value={control.id}>
                {control.control_id} - {control.control_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingQuestion ? 'Edit Question' : 'Create New Question'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('department_id', {
                      onChange: (e) => {
                        const deptId = e.target.value
                        setSelectedDepartment(deptId)
                        setValue('control_id', '')
                        setValue('control_name', '')
                        const frameworkId = watch('compliance_framework_id')
                        if (deptId) {
                          loadISOControls(deptId, frameworkId || null)
                        }
                      }
                    })}
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
                    Compliance Framework <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('compliance_framework_id', {
                      onChange: (e) => {
                        const frameworkId = e.target.value
                        setValue('control_id', '')
                        setValue('control_name', '')
                        const deptId = watch('department_id')
                        if (deptId) {
                          loadISOControls(deptId, frameworkId || null)
                        }
                      }
                    })}
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Control Name <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('control_name', {
                    onChange: (e) => {
                      const selectedName = e.target.value
                      if (selectedName && formDepartmentId) {
                        const control = filteredISOControls.find(c => c.control_name === selectedName)
                        if (control) {
                          setValue('control_id', control.control_id)
                        }
                      }
                    }
                  })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  disabled={!selectedDeptId}
                >
                  <option value="">Select a control name</option>
                  {filteredISOControls.map((control) => (
                    <option key={control.id} value={control.control_name}>
                      {control.control_name}
                    </option>
                  ))}
                </select>
                {errors.control_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.control_name.message}</p>
                )}
                {!selectedDeptId && (
                  <p className="mt-1 text-sm text-gray-500">Please select a department first</p>
                )}
                {selectedDeptId && filteredISOControls.length === 0 && (
                  <p className="mt-1 text-sm text-gray-500">No controls found for this department. Create controls first.</p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  Select a control name or enter a new one. The Control ID will be auto-filled.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Control ID <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('control_id', {
                    onChange: (e) => {
                      const selectedId = e.target.value
                      if (selectedId && formDepartmentId) {
                        const control = filteredISOControls.find(c => c.control_id === selectedId)
                        if (control) {
                          setValue('control_name', control.control_name)
                        }
                      }
                    }
                  })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  disabled={!selectedDeptId}
                >
                  <option value="">Select a control ID</option>
                  {filteredISOControls.map((control) => (
                    <option key={control.id} value={control.control_id}>
                      {control.control_id}
                    </option>
                  ))}
                </select>
                {errors.control_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.control_id.message}</p>
                )}
                {!selectedDeptId && (
                  <p className="mt-1 text-sm text-gray-500">Please select a department first</p>
                )}
                {selectedDeptId && filteredISOControls.length === 0 && (
                  <p className="mt-1 text-sm text-gray-500">No controls found for this department. Create controls first.</p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  Select a control ID or enter a new one (e.g., A.9.2.1). The Control Name will be auto-filled.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Text <span className="text-red-500">*</span>
                </label>
                <Input
                  {...register('text')}
                  placeholder="Enter question text"
                />
                {errors.text && (
                  <p className="mt-1 text-sm text-red-600">{errors.text.message}</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  {editingQuestion ? 'Update' : 'Create'} Question
                </Button>
                {!editingQuestion && (
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      handleSubmit((data) => onSubmit(data, true))()
                    }}
                    variant="outline"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create & Add Another
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setEditingQuestion(null)
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
        {questions.map((question) => (
          <Card key={question.id}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-600">
                      {getDepartmentName(question.iso_control_id)}
                    </span>
                    <span className="text-xs text-gray-500">
                      • {getISOControlInfo(question.iso_control_id)}
                    </span>
                    {question.question_id && (
                      <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                        {getQuestionDisplayId(question)}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-900">{question.text}</p>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(question)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(question.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {questions.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No questions found. Create your first question to get started.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default Questions
