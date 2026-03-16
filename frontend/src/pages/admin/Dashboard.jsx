import { useEffect, useState } from 'react'
import { adminService } from '../../services/adminService'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { TrendingUp, FileQuestion, Users, Building2, Shield, CheckCircle2, BarChart3 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line,
  RadialBarChart, RadialBar,
  ScatterChart, Scatter, ZAxis
} from 'recharts'

const Dashboard = () => {
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [summaryStats, setSummaryStats] = useState({
    totalDepartments: 0,
    totalQuestions: 0,
    totalAnswered: 0,
    overallCompletion: 0
  })

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const data = await adminService.getDashboardStats()
      setStats(data)
      
      // Calculate summary statistics
      const totalDepartments = data.length
      const totalQuestions = data.reduce((sum, stat) => sum + stat.total_questions, 0)
      const totalAnswered = data.reduce((sum, stat) => sum + stat.answered_questions, 0)
      const overallCompletion = totalQuestions > 0 
        ? (totalAnswered / totalQuestions * 100) 
        : 0

      setSummaryStats({
        totalDepartments,
        totalQuestions,
        totalAnswered,
        overallCompletion: Math.round(overallCompletion * 10) / 10
      })
    } catch (error) {
      toast.error('Failed to load dashboard stats')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8 animate-fade-in">
      {/* Header – login-inspired enterprise gradient */}
      <div className="page-hero">
        <div className="absolute inset-0 data-grid-pattern opacity-50" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-white/20 shrink-0">
            <span className="material-icons-outlined text-2xl text-blue-400">dashboard</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm sm:text-base text-slate-400 mt-1">
              Overview of compliance completion across departments
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="transition-all duration-300 hover:shadow-md">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Total Departments</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{summaryStats.totalDepartments}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/50 shrink-0">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-300 hover:shadow-md">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Total Questions</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{summaryStats.totalQuestions}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/50 shrink-0">
                <FileQuestion className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-300 hover:shadow-md">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Answered</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{summaryStats.totalAnswered}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/50 shrink-0">
                <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-300 hover:shadow-md">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Overall Completion</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{summaryStats.overallCompletion.toFixed(1)}%</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/50 shrink-0">
                <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      {stats.length > 0 && (
        <div className="space-y-6">
          <div className="mb-4">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white mb-1">Analytics</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Charts and graphs from current dashboard data</p>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Bar chart: completion % by department */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Completion % by Department</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.map(s => ({ name: s.department_name?.slice(0, 12) || 'Dept', completion: s.completion_percentage, fullName: s.department_name }))} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-slate-600 dark:text-slate-400" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} className="text-slate-600 dark:text-slate-400" />
                      <Tooltip content={({ active, payload }) => active && payload?.[0] && <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg px-3 py-2 text-sm"><span className="font-medium">{payload[0].payload.fullName}</span><br />Completion: {payload[0].value?.toFixed(1)}%</div>} />
                      <Bar dataKey="completion" fill="#2563eb" radius={[4, 4, 0, 0]} name="Completion %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Pie: answered vs remaining */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Questions: Answered vs Remaining</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Answered', value: summaryStats.totalAnswered, color: '#10b981' },
                          { name: 'Remaining', value: Math.max(0, summaryStats.totalQuestions - summaryStats.totalAnswered), color: '#94a3b8' }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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

            {/* Line: completion profile across departments */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Completion Profile (by department order)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.map((s, i) => ({ index: i + 1, name: s.department_name?.slice(0, 10) || `Dept ${i + 1}`, completion: s.completion_percentage }))} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-slate-600 dark:text-slate-400" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} className="text-slate-600 dark:text-slate-400" />
                      <Tooltip content={({ active, payload }) => active && payload?.[0] && <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg px-3 py-2 text-sm">{payload[0].payload.name}: {payload[0].value?.toFixed(1)}%</div>} />
                      <Line type="monotone" dataKey="completion" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} name="Completion %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Radial: overall completion gauge */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Overall Completion Gauge</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart innerRadius="60%" outerRadius="100%" data={[{ name: 'Completion', value: summaryStats.overallCompletion, fill: '#2563eb' }]} startAngle={180} endAngle={0}>
                      <RadialBar background dataKey="value" cornerRadius={8} />
                      <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Overall']} contentStyle={{ borderRadius: 8 }} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <p className="text-center text-2xl font-bold text-slate-900 dark:text-white -mt-16">{summaryStats.overallCompletion.toFixed(1)}%</p>
                </div>
              </CardContent>
            </Card>

            {/* Bubble/Scatter: departments by size and completion */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Departments: Question Count vs Completion (bubble size = answered)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 16, right: 16, left: 16, bottom: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis type="number" dataKey="total" name="Total questions" unit="" tick={{ fontSize: 11 }} className="text-slate-600 dark:text-slate-400" />
                      <YAxis type="number" dataKey="completion" name="Completion %" domain={[0, 100]} tick={{ fontSize: 11 }} className="text-slate-600 dark:text-slate-400" />
                      <ZAxis type="number" dataKey="answered" range={[100, 800]} name="Answered" />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => active && payload?.[0] && (() => {
                        const p = payload[0].payload
                        return <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg px-3 py-2 text-sm"><span className="font-medium">{p.name}</span><br />Questions: {p.answered}/{p.total}<br />Completion: {p.completion?.toFixed(1)}%</div>
                      })()} />
                      <Scatter name="Departments" data={stats.map(s => ({ name: s.department_name, total: s.total_questions, completion: s.completion_percentage, answered: s.answered_questions }))} fill="#2563eb" fillOpacity={0.7} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Department Stats Section */}
      <div>
        <div className="mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white mb-1">Department Compliance</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track compliance progress across all departments</p>
        </div>

        {stats.length === 0 ? (
          <Card className="animate-scale-in border-0 shadow-lg">
            <CardContent className="py-16 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                  <Building2 className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-slate-900 dark:text-white font-semibold text-lg">No departments found</p>
                <p className="text-slate-600 dark:text-slate-400 text-sm max-w-md">
                  Create departments to get started with compliance tracking
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat) => (
              <Card key={stat.department_id} hover className="transition-all duration-300 hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 sm:pb-4">
                  <CardTitle className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white break-words pr-2 min-w-0 flex-1">
                    {stat.department_name}
                  </CardTitle>
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex-shrink-0 ml-2">
                    <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </CardHeader>
                <CardContent className="pt-4 sm:pt-6">
                  {/* Compliance Framework Tags */}
                  {stat.compliance_frameworks && stat.compliance_frameworks.length > 0 ? (
                    <div className="mb-3 sm:mb-4 flex flex-wrap gap-1.5 sm:gap-2">
                      {stat.compliance_frameworks.map((framework) => (
                        <span
                          key={framework.id}
                          className="inline-flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50"
                          title={framework.version ? `${framework.name} ${framework.version}` : framework.name}
                        >
                          <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                          <span className="truncate max-w-[120px] sm:max-w-none">{framework.name}</span>
                          {framework.version && (
                            <span className="text-blue-600 dark:text-blue-400 shrink-0">({framework.version})</span>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mb-3 sm:mb-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 italic bg-slate-100 dark:bg-slate-700/50">
                        <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span className="text-xs">No frameworks assigned</span>
                      </span>
                    </div>
                  )}
                  
                  {/* Completion Percentage */}
                  <div className="mb-3 sm:mb-4">
                    <div className="flex items-baseline gap-2 mb-1 sm:mb-2">
                      <span className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {stat.completion_percentage.toFixed(1)}%
                      </span>
                      {stat.completion_percentage >= 80 && (
                        <span className="material-icons-outlined text-green-500 text-lg sm:text-xl">trending_up</span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">
                      <span className="font-semibold text-slate-900 dark:text-white">{stat.answered_questions}</span> of{' '}
                      <span className="font-semibold text-slate-900 dark:text-white">{stat.total_questions}</span> questions answered
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-2.5 rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-700 ease-out"
                      style={{ width: `${Math.min(stat.completion_percentage, 100)}%` }}
                    />
                  </div>

                  {/* Status Indicator */}
                  <div className="mt-4 flex items-center gap-2">
                    {stat.completion_percentage === 100 ? (
                      <>
                        <span className="material-icons-outlined text-green-500 text-lg">check_circle</span>
                        <span className="text-xs font-semibold text-green-600 dark:text-green-400">Complete</span>
                      </>
                    ) : stat.completion_percentage >= 80 ? (
                      <>
                        <span className="material-icons-outlined text-blue-500 text-lg">trending_up</span>
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">On Track</span>
                      </>
                    ) : stat.completion_percentage >= 50 ? (
                      <>
                        <span className="material-icons-outlined text-orange-500 text-lg">schedule</span>
                        <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">In Progress</span>
                      </>
                    ) : (
                      <>
                        <span className="material-icons-outlined text-red-500 text-lg">warning</span>
                        <span className="text-xs font-semibold text-red-600 dark:text-red-400">Needs Attention</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
