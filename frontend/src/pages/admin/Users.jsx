import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { adminService } from '../../services/adminService'
import { authService } from '../../services/authService'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Plus, Trash2, Shield, User, Building2, ArrowLeft, Users as UsersIcon, UserCog } from 'lucide-react'

const userSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'user']),
  department_id: z.string().optional(),
  is_senior: z.boolean().optional(),
})

const Users = () => {
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showSeniorForm, setShowSeniorForm] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [viewMode, setViewMode] = useState('departments') // 'departments' or 'users'

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: 'user',
    },
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [usersData, departmentsData] = await Promise.all([
        adminService.getUsers(),
        adminService.getDepartments(),
      ])
      setUsers(usersData)
      setDepartments(departmentsData)
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data) => {
    try {
      // If creating from department view, auto-assign department
      if (viewMode === 'users' && selectedDepartment && !data.department_id) {
        data.department_id = selectedDepartment.id || selectedDepartment._id
      }
      
      // Ensure is_senior is explicitly set
      if (data.is_senior === undefined) {
        data.is_senior = false
      }
      
      console.log('Creating user with data:', data) // Debug log
      
      await authService.register(data)
      toast.success(data.is_senior ? 'Senior user created successfully' : 'User created successfully')
      reset()
      setShowForm(false)
      setShowSeniorForm(false)
      loadData()
    } catch (error) {
      console.error('Error creating user:', error) // Debug log
      toast.error(error.response?.data?.detail || 'Failed to create user')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return

    try {
      await adminService.deleteUser(id)
      toast.success('User deleted successfully')
      loadData()
    } catch (error) {
      toast.error('Failed to delete user')
    }
  }

  const getDepartmentName = (departmentId) => {
    if (!departmentId) return 'Not assigned'
    const dept = departments.find((d) => d.id === departmentId)
    return dept?.name || 'Unknown'
  }

  // Separate admin users from regular users
  const adminUsers = users.filter(user => user.role === 'admin')
  const regularUsers = users.filter(user => user.role !== 'admin')

  // Group users by department
  const usersByDepartment = departments.map(dept => {
    const deptUsers = regularUsers.filter(user => {
      const userDeptId = user.department_id || user.department_id?._id || user.department_id?.id
      const deptId = dept.id || dept._id
      return String(userDeptId) === String(deptId)
    })
    return {
      ...dept,
      users: deptUsers,
      userCount: deptUsers.length
    }
  })

  // Get users for selected department
  const getSelectedDepartmentUsers = () => {
    if (!selectedDepartment) return []
    return regularUsers.filter(user => {
      const userDeptId = user.department_id || user.department_id?._id || user.department_id?.id
      const deptId = selectedDepartment.id || selectedDepartment._id
      return String(userDeptId) === String(deptId)
    })
  }

  const handleDepartmentClick = (department) => {
    setSelectedDepartment(department)
    setViewMode('users')
  }

  const handleBackToDepartments = () => {
    setSelectedDepartment(null)
    setViewMode('departments')
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div className="page-hero">
        <div className="absolute inset-0 data-grid-pattern opacity-50" />
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            {viewMode === 'users' && (
              <Button variant="outline" onClick={handleBackToDepartments} className="flex-shrink-0 border-white/30 bg-white/10 text-white hover:bg-white/20 dark:border-white/30 dark:bg-white/10 dark:text-white dark:hover:bg-white/20">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-white/20 shrink-0">
              <span className="material-icons-outlined text-2xl text-blue-400">people</span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">User Management</h1>
              <p className="text-sm text-slate-400 mt-1">
                {viewMode === 'departments'
                  ? 'View users grouped by departments'
                  : selectedDepartment
                    ? `Users in ${selectedDepartment.name}`
                    : 'Create and manage user accounts'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
            {viewMode === 'users' && selectedDepartment && (
              <Button
                onClick={() => {
                  setShowSeniorForm(!showSeniorForm)
                  setShowForm(false)
                  reset()
                }}
                size="lg"
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 dark:border-white/30 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                <UserCog className="w-5 h-5 mr-2" />
                {showSeniorForm ? 'Cancel' : `Add Senior`}
              </Button>
            )}
            <Button
              onClick={() => {
                setShowForm(!showForm)
                setShowSeniorForm(false)
                reset()
              }}
              size="lg"
              className="bg-white/20 border border-white/30 text-white hover:bg-white/30 dark:bg-white/20 dark:text-white dark:hover:bg-white/30"
            >
              <Plus className="w-5 h-5 mr-2" />
              {showForm ? 'Cancel' : 'Add User'}
            </Button>
          </div>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New User</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Username
                </label>
                <Input
                  {...register('username')}
                  placeholder="Enter username"
                />
                {errors.username && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">{errors.username.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <Input
                  type="password"
                  {...register('password')}
                  placeholder="Enter password"
                />
                {errors.password && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Role
                </label>
                <select
                  {...register('role')}
                  className="block w-full h-11 px-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                {errors.role && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">{errors.role.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Department (Optional - Required for Users)
                </label>
                <select
                  {...register('department_id')}
                  defaultValue={viewMode === 'users' && selectedDepartment ? (selectedDepartment.id || selectedDepartment._id) : ''}
                  className="block w-full h-11 px-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                >
                  <option value="">Not assigned</option>
                  {departments.map((dept) => (
                    <option key={dept.id || dept._id} value={dept.id || dept._id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Users must be assigned to a department</p>
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="flex-1">Create User</Button>
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

      {showSeniorForm && selectedDepartment && (
        <Card className="animate-scale-in shadow-xl border-2 border-indigo-300 dark:border-indigo-700">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                <UserCog className="w-6 h-6 text-white" />
              </div>
              <CardTitle>Create Senior User - {selectedDepartment.name}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((data) => {
              // Explicitly set senior user fields - ensure is_senior is explicitly true
              const seniorUserData = {
                username: data.username,
                password: data.password,
                role: 'user', // Senior users are still regular users
                department_id: selectedDepartment.id || selectedDepartment._id,
                is_senior: true // Explicitly set to true for senior users
              }
              console.log('Creating senior user with data:', seniorUserData) // Debug
              console.log('is_senior value:', seniorUserData.is_senior, 'type:', typeof seniorUserData.is_senior)
              onSubmit(seniorUserData)
            })} className="space-y-6">
              <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 mb-1">
                  Department: <span className="text-indigo-700 dark:text-indigo-300">{selectedDepartment.name}</span>
                </p>
                <p className="text-xs text-indigo-700 dark:text-indigo-400">
                  This user will be created as a Senior User for {selectedDepartment.name}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Username
                </label>
                <Input
                  {...register('username')}
                  placeholder="Enter username"
                />
                {errors.username && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">{errors.username.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <Input
                  type="password"
                  {...register('password')}
                  placeholder="Enter password"
                />
                {errors.password && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">{errors.password.message}</p>
                )}
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
                  <UserCog className="w-4 h-4 mr-2" />
                  Create Senior User
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowSeniorForm(false)
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

      {viewMode === 'departments' ? (
        <>
          {/* Admin Users Section */}
          {adminUsers.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Master Admin</h2>
                <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm font-semibold">
                  {adminUsers.length} {adminUsers.length === 1 ? 'Admin' : 'Admins'}
                </span>
              </div>
              <Card className="shadow-xl">
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {adminUsers.map((user) => (
                      <div key={user.id} className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
                            <Shield className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-gray-100">{user.username}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Master Administrator</p>
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(user.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Departments Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Departments</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {usersByDepartment.map((dept, index) => (
                <Card 
                  key={dept.id || dept._id} 
                  hover={true}
                  className="animate-slide-in-up cursor-pointer"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => handleDepartmentClick(dept)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                      <div className="px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 text-sm font-bold">
                        {dept.userCount} {dept.userCount === 1 ? 'User' : 'Users'}
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{dept.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Click to view users in this department
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {usersByDepartment.length === 0 && (
              <Card className="animate-scale-in">
                <CardContent className="py-16 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 font-medium text-lg">No departments found</p>
                    <p className="text-gray-500 dark:text-gray-500 text-sm">Create departments to organize users</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      ) : (
        /* Users List View */
        <div className="space-y-4">
          {getSelectedDepartmentUsers().map((user) => {
            // Check for senior user status - handle multiple formats
            const isSenior = user.is_senior === true || 
                           user.isSenior === true || 
                           user.is_senior === 1 ||
                           (user.is_senior !== undefined && user.is_senior !== null && String(user.is_senior).toLowerCase() === 'true')
            
            // Debug: log user object to see what fields are available
            console.log('User object:', {
              username: user.username,
              is_senior: user.is_senior,
              isSenior: user.isSenior,
              allFields: Object.keys(user),
              calculatedIsSenior: isSenior
            })
            
            return (
              <Card key={user.id} hover={true} className="animate-slide-in-up">
                <CardContent className="p-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 flex-1">
                      {isSenior ? (
                        <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 shadow-md">
                          <UserCog className="w-5 h-5 text-white" />
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md">
                          <User className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-gray-900 dark:text-gray-100">{user.username}</p>
                          {isSenior && (
                            <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 text-indigo-800 dark:text-indigo-200 text-xs font-bold border border-indigo-300 dark:border-indigo-700">
                              Senior User
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          User • {selectedDepartment?.name || 'Unknown Department'}
                          {isSenior && (
                            <span className="ml-2 text-indigo-600 dark:text-indigo-400 font-semibold">
                              • Senior for {selectedDepartment?.name}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(user.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {getSelectedDepartmentUsers().length === 0 && (
            <Card className="animate-scale-in">
              <CardContent className="py-16 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center">
                    <UsersIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium text-lg">No users in this department</p>
                  <p className="text-gray-500 dark:text-gray-500 text-sm">Add users to this department to get started</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

export default Users

