import { useEffect, useState } from 'react'
import { userService } from '../../services/userService'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Building2, Users, FileQuestion, CheckCircle2, TrendingUp, AlertCircle, CheckSquare, Plus, Trash2, Edit2, Calendar, User, Flag, XCircle, FileCheck, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/authStore'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line,
  RadialBarChart, RadialBar,
  ScatterChart, Scatter, ZAxis
} from 'recharts'

const SeniorDashboard = () => {
  const { user } = useAuthStore()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [departmentUsers, setDepartmentUsers] = useState([])
  const [departmentInfo, setDepartmentInfo] = useState(null)
  const [tasks, setTasks] = useState([])
  const [proofApprovals, setProofApprovals] = useState([])
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState(null)
  const [approvalComments, setApprovalComments] = useState('')
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    status: 'pending',
    priority: 'medium',
    assigned_to_user_id: '',
    due_date: ''
  })

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const [statsData, usersData, tasksData, approvalsData] = await Promise.all([
        userService.getDepartmentStats(),
        userService.getDepartmentUsers(),
        userService.getTasks().catch(() => []), // Handle errors gracefully
        userService.getPendingProofApprovals().catch(() => []) // Handle errors gracefully
      ])
      setStats(statsData)
      setDepartmentUsers(usersData || [])
      setDepartmentInfo(statsData)
      setTasks(tasksData || [])
      setProofApprovals(approvalsData || [])
    } catch (error) {
      console.error('Error loading dashboard:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTask = () => {
    setEditingTask(null)
    setTaskForm({
      title: '',
      description: '',
      status: 'pending',
      priority: 'medium',
      assigned_to_user_id: '',
      due_date: ''
    })
    setShowTaskModal(true)
  }

  const handleEditTask = (task) => {
    setEditingTask(task)
    setTaskForm({
      title: task.title || '',
      description: task.description || '',
      status: task.status || 'pending',
      priority: task.priority || 'medium',
      assigned_to_user_id: task.assigned_to_user_id || '',
      due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : ''
    })
    setShowTaskModal(true)
  }

  const handleSaveTask = async () => {
    if (!taskForm.title.trim()) {
      toast.error('Task title is required')
      return
    }

    try {
      const taskData = {
        title: taskForm.title,
        description: taskForm.description,
        status: taskForm.status,
        priority: taskForm.priority,
        assigned_to_user_id: taskForm.assigned_to_user_id || null,
        due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null
      }

      if (editingTask) {
        await userService.updateTask(editingTask.id || editingTask._id, taskData)
        toast.success('Task updated successfully')
      } else {
        await userService.createTask(taskData)
        toast.success('Task created successfully')
      }

      setShowTaskModal(false)
      loadDashboardData()
    } catch (error) {
      console.error('Error saving task:', error)
      toast.error(error.response?.data?.detail || 'Failed to save task')
    }
  }

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return
    }

    try {
      await userService.deleteTask(taskId)
      toast.success('Task deleted successfully')
      loadDashboardData()
    } catch (error) {
      console.error('Error deleting task:', error)
      toast.error(error.response?.data?.detail || 'Failed to delete task')
    }
  }

  const handleApproveProof = (approval) => {
    setSelectedApproval(approval)
    setApprovalComments('')
    setShowApprovalModal(true)
  }

  const handleSubmitApproval = async (status) => {
    if (!selectedApproval) return

    try {
      await userService.approveProof(selectedApproval.id || selectedApproval._id, {
        response_id: selectedApproval.response_id || selectedApproval.response_id?._id || selectedApproval.response_id?.id,
        approval_status: status,
        comments: approvalComments
      })
      toast.success(`Proof ${status === 'approved' ? 'approved' : 'rejected'} successfully`)
      setShowApprovalModal(false)
      setSelectedApproval(null)
      setApprovalComments('')
      loadDashboardData()
    } catch (error) {
      console.error('Error submitting approval:', error)
      toast.error(error.response?.data?.detail || 'Failed to submit approval')
    }
  }

  const getSubmittedByUsername = (userId) => {
    if (!userId) return 'Unknown'
    const user = departmentUsers.find(u => (u.id || u._id) === userId)
    return user ? user.username : 'Unknown'
  }

  const handleDownloadProof = async (responseId, proofUrl) => {
    try {
      const responseIdStr = responseId || responseId?._id || responseId?.id
      if (!responseIdStr) {
        toast.error('Invalid response ID')
        return
      }
      
      const blob = await userService.downloadProof(responseIdStr)
      
      // Extract file extension from proof_url if available
      let fileExtension = '.pdf' // default
      if (proofUrl) {
        const match = proofUrl.match(/\.([a-zA-Z0-9]+)$/)
        if (match) {
          fileExtension = '.' + match[1]
        }
      }
      
      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `proof-${responseIdStr}${fileExtension}`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success('Proof file downloaded successfully')
    } catch (error) {
      console.error('Error downloading proof:', error)
      toast.error(error.response?.data?.detail || 'Failed to download proof file')
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-700'
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300 dark:border-orange-700'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700'
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-300 dark:border-gray-700'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300 dark:border-blue-700'
      case 'pending':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-300 dark:border-gray-700'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-300 dark:border-gray-700'
    }
  }

  const getAssignedUserName = (userId) => {
    if (!userId) return 'Unassigned'
    const user = departmentUsers.find(u => (u.id || u._id) === userId)
    return user ? user.username : 'Unknown'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-slate-300 dark:border-slate-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="space-y-8 animate-fade-in">
        <Card className="animate-scale-in">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="w-16 h-16 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400 font-medium text-lg">No department assigned</p>
              <p className="text-gray-500 dark:text-gray-500 text-sm">Please contact administrator to assign you to a department</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header – login-inspired */}
      <div className="page-hero">
        <div className="absolute inset-0 data-grid-pattern opacity-50" />
        <div className="absolute top-1/4 right-1/4 w-48 h-48 bg-blue-600/10 blur-[80px] rounded-full" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-white/20 shrink-0">
            <Building2 className="w-6 h-6 text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">Department Dashboard</h1>
            <p className="text-sm text-slate-400 mt-1">Compliance statistics for {stats.department_name}</p>
          </div>
        </div>
      </div>

      {/* Main Stats Card */}
      <Card>
        <CardHeader className="bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-slate-200/80 dark:bg-slate-700/80">
              <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-xl">{stats.department_name}</CardTitle>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Department compliance overview</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {/* Completion Percentage */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Completion</span>
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                {stats.completion_percentage.toFixed(1)}%
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-3 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-700 ease-out"
                  style={{ width: `${stats.completion_percentage}%` }}
                />
              </div>
            </div>

            {/* Total Questions */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700/50">
                  <FileQuestion className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Questions</span>
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                {stats.total_questions}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Questions in department</p>
            </div>

            {/* Answered Questions */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Answered</span>
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                {stats.answered_questions}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {stats.total_questions > 0
                  ? `${((stats.answered_questions / stats.total_questions) * 100).toFixed(1)}% completed`
                  : 'No questions yet'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Section - Senior */}
      <div className="space-y-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white mb-1">Analytics</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Charts from your department and tasks</p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Bar: tasks by status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tasks by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Pending', count: tasks.filter(t => (t.status || 'pending') === 'pending').length },
                      { name: 'In Progress', count: tasks.filter(t => t.status === 'in_progress').length },
                      { name: 'Completed', count: tasks.filter(t => t.status === 'completed').length }
                    ]}
                    margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-slate-600 dark:text-slate-400" />
                    <YAxis tick={{ fontSize: 11 }} className="text-slate-600 dark:text-slate-400" />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} name="Tasks" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Pie: answered vs remaining (department) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Department: Answered vs Remaining</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Answered', value: stats.answered_questions, color: '#10b981' },
                        { name: 'Remaining', value: Math.max(0, stats.total_questions - stats.answered_questions), color: '#94a3b8' }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => (percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : '')}
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#94a3b8" />
                    </Pie>
                    <Tooltip formatter={(value) => [value, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Line: tasks by status (profile) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Task Status Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[
                      { name: 'Pending', count: tasks.filter(t => (t.status || 'pending') === 'pending').length },
                      { name: 'In Progress', count: tasks.filter(t => t.status === 'in_progress').length },
                      { name: 'Completed', count: tasks.filter(t => t.status === 'completed').length }
                    ]}
                    margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-slate-600 dark:text-slate-400" />
                    <YAxis tick={{ fontSize: 11 }} className="text-slate-600 dark:text-slate-400" />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} name="Tasks" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Radial: department completion gauge */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Department Completion Gauge</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="60%" outerRadius="100%" data={[{ name: 'Completion', value: stats.completion_percentage, fill: '#2563eb' }]} startAngle={180} endAngle={0}>
                    <RadialBar background dataKey="value" cornerRadius={8} />
                    <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Completion']} contentStyle={{ borderRadius: 8 }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <p className="text-center text-2xl font-bold text-slate-900 dark:text-white -mt-14">{stats.completion_percentage.toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>

          {/* Bubble: department (single point – total questions vs completion, size = answered) */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Department Overview (bubble: total questions vs completion, size = answered)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 16, right: 16, left: 16, bottom: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                    <XAxis type="number" dataKey="total" name="Total questions" domain={[0, Math.max(stats.total_questions + 5, 10)]} tick={{ fontSize: 11 }} className="text-slate-600 dark:text-slate-400" />
                    <YAxis type="number" dataKey="completion" name="Completion %" domain={[0, 100]} tick={{ fontSize: 11 }} className="text-slate-600 dark:text-slate-400" />
                    <ZAxis type="number" dataKey="answered" range={[200, 800]} name="Answered" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => active && payload?.[0] && (() => {
                      const p = payload[0].payload
                      return <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg px-3 py-2 text-sm"><span className="font-medium">{p.name}</span><br />Questions: {p.answered}/{p.total}<br />Completion: {p.completion?.toFixed(1)}%</div>
                    })()} />
                    <Scatter name="Department" data={[{ name: stats.department_name, total: stats.total_questions, completion: stats.completion_percentage, answered: stats.answered_questions }]} fill="#2563eb" fillOpacity={0.7} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Department Users */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/50">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <CardTitle>Department Users</CardTitle>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold">
              {departmentUsers.length} {departmentUsers.length === 1 ? 'User' : 'Users'}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {departmentUsers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departmentUsers.map((deptUser) => (
                <div
                  key={deptUser.id || deptUser._id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-semibold text-sm">
                      {deptUser.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{deptUser.username}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{deptUser.role || 'User'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-500 dark:text-slate-400">No users found in this department</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Proof Approvals Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/50">
              <FileCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle>Proof Approvals</CardTitle>
            <span className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs font-semibold">
              {proofApprovals.length} {proofApprovals.length === 1 ? 'Pending' : 'Pending'}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {proofApprovals.length > 0 ? (
            <div className="space-y-4">
              {proofApprovals.map((approval, index) => (
                <div
                  key={approval.id || approval._id}
                  className="p-5 bg-gradient-to-br from-white to-orange-50 dark:from-gray-800 dark:to-orange-900/20 rounded-xl border-2 border-orange-200 dark:border-orange-800 hover:border-orange-300 dark:hover:border-orange-700 transition-all duration-300 animate-slide-in-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {approval.title}
                        </h3>
                        <span className="px-2 py-1 rounded-md text-xs font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-700">
                          Pending Approval
                        </span>
                      </div>
                      {approval.description && (
                        <p className="text-gray-600 dark:text-gray-400 mb-3 whitespace-pre-line">{approval.description}</p>
                      )}
                      <div className="flex items-center gap-4 flex-wrap mb-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <User className="w-4 h-4" />
                          <span>Submitted by: <strong>{getSubmittedByUsername(approval.submitted_by_user_id)}</strong></span>
                        </div>
                        {approval.created_at && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Calendar className="w-4 h-4" />
                            <span>Submitted: <strong>{new Date(approval.created_at).toLocaleDateString()}</strong></span>
                          </div>
                        )}
                      </div>
                      {approval.proof_url && (
                        <div className="mb-3">
                          <button
                            onClick={() => handleDownloadProof(approval.response_id, approval.proof_url)}
                            className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium cursor-pointer underline"
                          >
                            <FileQuestion className="w-4 h-4" />
                            View Proof File
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApproveProof(approval)}
                        className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                        title="Approve proof"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedApproval(approval)
                          setApprovalComments('')
                          setShowApprovalModal(true)
                        }}
                        className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        title="Reject proof"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 font-medium text-lg mb-2">No pending proof approvals</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm">All proofs have been reviewed</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks Section */}
      <Card className="shadow-xl animate-slide-in-up" style={{ animationDelay: '0.3s' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                <CheckSquare className="w-6 h-6 text-white" />
              </div>
              <CardTitle>Tasks</CardTitle>
              <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm font-bold">
                {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
              </span>
            </div>
            <Button
              onClick={handleCreateTask}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length > 0 ? (
            <div className="space-y-4">
              {tasks.map((task, index) => (
                <div
                  key={task.id || task._id}
                  className="p-5 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 animate-slide-in-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {task.title}
                        </h3>
                        <span className={`px-2 py-1 rounded-md text-xs font-semibold border ${getPriorityColor(task.priority)}`}>
                          <Flag className="w-3 h-3 inline mr-1" />
                          {task.priority}
                        </span>
                        <span className={`px-2 py-1 rounded-md text-xs font-semibold border ${getStatusColor(task.status)}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-gray-600 dark:text-gray-400 mb-3">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 flex-wrap">
                        {task.assigned_to_user_id && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <User className="w-4 h-4" />
                            <span>Assigned to: <strong>{getAssignedUserName(task.assigned_to_user_id)}</strong></span>
                          </div>
                        )}
                        {task.due_date && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Calendar className="w-4 h-4" />
                            <span>Due: <strong>{new Date(task.due_date).toLocaleDateString()}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditTask(task)}
                        className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                        title="Edit task"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id || task._id)}
                        className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        title="Delete task"
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
              <CheckSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 font-medium text-lg mb-2">No tasks yet</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">Create your first task to get started</p>
              <Button
                onClick={handleCreateTask}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">
                  {editingTask ? 'Edit Task' : 'Create New Task'}
                </CardTitle>
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Task Title *
                </label>
                <Input
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="Enter task title"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="Enter task description"
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Priority
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Assign To
                  </label>
                  <select
                    value={taskForm.assigned_to_user_id}
                    onChange={(e) => setTaskForm({ ...taskForm, assigned_to_user_id: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Unassigned</option>
                    {departmentUsers.map((user) => (
                      <option key={user.id || user._id} value={user.id || user._id}>
                        {user.username}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Due Date
                  </label>
                  <Input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  onClick={() => setShowTaskModal(false)}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTask}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {editingTask ? 'Update Task' : 'Create Task'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedApproval && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">
                  Review Proof
                </CardTitle>
                <button
                  onClick={() => {
                    setShowApprovalModal(false)
                    setSelectedApproval(null)
                    setApprovalComments('')
                  }}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {selectedApproval.title}
                </h3>
                {selectedApproval.description && (
                  <p className="text-gray-600 dark:text-gray-400 mb-4 whitespace-pre-line">{selectedApproval.description}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Comments (Optional)
                </label>
                <textarea
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  placeholder="Add any comments about your decision..."
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  onClick={() => {
                    setShowApprovalModal(false)
                    setSelectedApproval(null)
                    setApprovalComments('')
                  }}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleSubmitApproval('rejected')}
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => handleSubmitApproval('approved')}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default SeniorDashboard

