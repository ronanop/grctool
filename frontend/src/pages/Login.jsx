import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import { authService } from '../services/authService'

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

const Login = () => {
  const navigate = useNavigate()
  const { setAuth, isAuthenticated, user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const hasRedirectedRef = useRef(false)

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true'
    setDarkMode(savedDarkMode)
    if (savedDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode
    setDarkMode(newDarkMode)
    localStorage.setItem('darkMode', newDarkMode.toString())
    document.documentElement.classList.toggle('dark')
  }

  useEffect(() => {
    if (!isAuthenticated || hasRedirectedRef.current) return
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return
    hasRedirectedRef.current = true
    let targetPath = '/login'
    if (currentUser.role === 'admin') {
      targetPath = '/admin/dashboard'
    } else {
      const isSenior = currentUser.is_senior === true || currentUser.isSenior === true || currentUser.is_senior === 1
      targetPath = isSenior ? '/user/dashboard' : '/user/checklist'
    }
    navigate(targetPath, { replace: true })
  }, [isAuthenticated, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const response = await authService.login(data.username, data.password)
      const token = response.access_token
      const userData = response.user
      if (!userData || !userData.role) {
        toast.error('Failed to get user information')
        return
      }
      setAuth(userData, token)
      toast.success('Login successful!')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen font-sans antialiased text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Left panel – branding & glass card */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden enterprise-gradient items-center justify-center p-16">
        <div className="absolute inset-0 data-grid-pattern" />
        <div className="absolute inset-0">
          <div className="absolute top-[-10%] left-[10%] w-[1px] h-full light-ray" />
          <div className="absolute top-[-20%] left-[40%] w-[2px] h-full light-ray opacity-50" />
          <div className="absolute top-[-5%] left-[70%] w-[1px] h-full light-ray opacity-30" />
        </div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 blur-[150px] rounded-full" />
        <div className="relative z-10 w-full max-w-xl">
          <div className="mb-16 inline-flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-white/20 backdrop-blur-xl">
              <span className="material-icons-outlined text-blue-400 text-3xl font-light">balance</span>
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">Sanchalan.ai</span>
          </div>
          <div className="space-y-6 mb-20">
            <h1 className="text-5xl font-semibold text-white leading-[1.1] tracking-tight">
              Structured Governance <br />
              <span className="text-blue-400/80">Digital Law Reimagined.</span>
            </h1>
            <p className="text-lg text-slate-400 font-normal leading-relaxed max-w-md">
              The enterprise-grade architectural foundation for automated risk management and legal oversight.
            </p>
          </div>
          <div className="relative">
            <div className="absolute -right-20 -top-40 w-[440px] h-[440px] pointer-events-none flex items-center justify-center">
              <div className="relative w-full h-full flex items-end justify-around pb-12">
                <div className="w-16 h-64 pillar-wireframe border border-blue-500/30 holographic-glow" />
                <div className="w-20 h-80 pillar-wireframe border border-blue-400/40 holographic-glow opacity-80" />
                <div className="w-16 h-64 pillar-wireframe border border-blue-500/30 holographic-glow" />
                <div className="absolute top-1/3 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />
              </div>
            </div>
            <div className="glass-card rounded-2xl p-8 relative overflow-hidden group border-white/10 max-w-sm shadow-2xl">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
              <div className="flex items-center justify-between mb-10">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-blue-400 uppercase tracking-[0.2em]">Compliance Architecture</p>
                  <p className="text-2xl font-semibold text-white">99.9% Automated</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <span className="material-icons-outlined text-blue-400 text-2xl">shield</span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between text-xs text-slate-500 font-medium">
                  <span>Regulatory Integrity</span>
                  <span className="text-blue-400">Verifying Nodes...</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex space-x-0.5">
                  <div className="h-full w-[45%] bg-blue-600/70" />
                  <div className="h-full w-[25%] bg-blue-500/70" />
                  <div className="h-full w-[25%] bg-blue-400/70" />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="text-[10px] text-slate-500 border-l border-white/10 pl-3">
                    <span className="block text-slate-300 font-medium">GOVERNANCE</span>
                    PROTOCOL ACTIVE
                  </div>
                  <div className="text-[10px] text-slate-500 border-l border-white/10 pl-3">
                    <span className="block text-slate-300 font-medium">ENCRYPTION</span>
                    AES-256 LAYERED
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel – form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white dark:bg-slate-950 p-8 sm:p-16 relative">
        <button
          type="button"
          className="absolute top-8 right-8 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
          onClick={toggleDarkMode}
        >
          <span className="material-icons-outlined text-[20px] dark:hidden">dark_mode</span>
          <span className="material-icons-outlined text-[20px] hidden dark:block">light_mode</span>
        </button>

        <div className="w-full max-w-[400px] space-y-10">
          {/* Mobile header */}
          <div className="lg:hidden text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Sanchalan.ai</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Digital Law & Compliance</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Professional Access</h2>
            <p className="text-[15px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Secure portal for compliance officers and legal teams.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <label className="block text-[13px] font-medium text-slate-600 dark:text-slate-400" htmlFor="username">
                Enterprise Email
              </label>
              <input
                id="username"
                type="text"
                placeholder="name@company.com"
                autoComplete="username"
                className={`w-full px-4 py-3.5 bg-slate-50/50 dark:bg-slate-900/50 border rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all dark:text-white text-slate-900 placeholder:text-slate-400 shadow-sm ${
                  errors.username ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                }`}
                {...register('username')}
              />
              {errors.username && (
                <p className="text-[13px] text-red-500 font-medium">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-[13px] font-medium text-slate-600 dark:text-slate-400" htmlFor="password">
                  Security Credentials
                </label>
                <a className="text-[13px] font-medium text-blue-600 dark:text-blue-400 hover:underline underline-offset-4" href="#">
                  Recovery
                </a>
              </div>
              <div className="relative group">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`w-full px-4 py-3.5 bg-slate-50/50 dark:bg-slate-900/50 border rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all dark:text-white text-slate-900 placeholder:text-slate-400 shadow-sm pr-12 ${
                    errors.password ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'
                  }`}
                  {...register('password')}
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="material-icons-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {errors.password && (
                <p className="text-[13px] text-red-500 font-medium">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <input
                id="remember"
                type="checkbox"
                className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-700 rounded focus:ring-offset-0 focus:ring-blue-500 dark:bg-slate-900"
              />
              <label className="text-[13px] text-slate-500 dark:text-slate-400" htmlFor="remember">
                Authorize for 30 days
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white font-semibold rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg shadow-slate-200/50 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <span className="material-icons-outlined text-[18px]">verified_user</span>
                </>
              )}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-[0.15em] font-semibold">
              <span className="bg-white dark:bg-slate-950 px-4 text-slate-400">Enterprise SSO</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              className="flex items-center justify-center px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all space-x-3 group"
            >
              <img
                alt="Google"
                className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB2H6jsde-LYm4FzT3aMxq9WIfCHrhZsuGfP1DLQrgNzmDu3NAuoomzI81MOcis3-EnVefbe33KQnQqELxpWm8FRlNSTIHWNJl--tAtpO9WXSesIrQrQdyahZQbcnCYvmIZOYfjHf640iyLmkjfYNyISDCJffOteo0uV0UHo3-PaKZOhD89uL9-jToA4yOScyyezHWdd6nVZIz6OsvVvbuyDrNDXTtFpnO-_IDZjbWc66ai_Hg5J6XGUB4blTy6rx0cytPvZiityyc"
              />
              <span className="text-[14px] font-medium text-slate-700 dark:text-slate-300">Google Workspace</span>
            </button>
            <button
              type="button"
              className="flex items-center justify-center px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all space-x-3"
            >
              <span className="material-icons-outlined text-[20px] text-slate-500">vpn_key</span>
              <span className="text-[14px] font-medium text-slate-700 dark:text-slate-300">Azure AD</span>
            </button>
          </div>

          <div className="pt-6 text-center">
            <p className="text-[14px] text-slate-500 dark:text-slate-400">
              Need infrastructure access?{' '}
              <a className="font-semibold text-slate-900 dark:text-white hover:underline underline-offset-4 ml-1" href="#">
                Request Demo
              </a>
            </p>
          </div>

          <div className="pt-12 flex justify-center space-x-8 text-[12px] text-slate-400 dark:text-slate-600 font-medium flex-wrap gap-y-2">
            <a className="hover:text-slate-900 dark:hover:text-slate-300 transition-colors" href="#">Legal Disclaimer</a>
            <a className="hover:text-slate-900 dark:hover:text-slate-300 transition-colors" href="#">Security Policy</a>
            <a className="hover:text-slate-900 dark:hover:text-slate-300 transition-colors" href="#">Data Governance</a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
