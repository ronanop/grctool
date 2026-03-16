import { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import { chatbotSettingsService } from '../services/chatbotSettingsService'
import Chatbot from './Chatbot'

const Layout = () => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mainNavOpen, setMainNavOpen] = useState(false)
  const [chatbotConfig, setChatbotConfig] = useState({ enabled: true, title: 'Assistant' })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isAdmin = user?.role === 'admin'
  const isSenior = user?.is_senior === true || user?.isSenior === true || user?.is_senior === 1

  const isActive = (path) => location.pathname === path

  // Main top nav: Dashboard, Departments, Control Management, etc.
  const mainNavLinks = isAdmin
    ? [
        { path: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
        { path: '/admin/departments', label: 'Departments', icon: 'business' },
        { path: '/admin/iso-controls', label: 'Control Management', icon: 'security' },
        { path: '/admin/compliance-frameworks', label: 'Frameworks', icon: 'verified' },
        { path: '/admin/questions', label: 'Questions', icon: 'help_outline' },
        { path: '/admin/users', label: 'Users', icon: 'people' },
      ]
    : isSenior
      ? [{ path: '/user/dashboard', label: 'Dashboard', icon: 'dashboard' }]
      : [{ path: '/user/checklist', label: 'Checklist', icon: 'assignment' }]

  // Left sidebar: Agent, RAG Documents, Local VD, then Profile + Logout
  const sidebarLinks = isAdmin
    ? [
        { path: '/admin/agents', label: 'Agent', icon: 'smart_toy' },
        { path: '/admin/rag-documents', label: 'RAG Documents', icon: 'menu_book' },
        { path: '/admin/local-vd', label: 'Local VD (vector database)', icon: 'storage' },
      ]
    : []

  useEffect(() => {
    if (!user) return
    chatbotSettingsService.getConfig().then(setChatbotConfig).catch(() => setChatbotConfig({ enabled: true, title: 'Assistant' }))
  }, [user])

  // Close sidebar when route changes (mobile)
  useEffect(() => {
    setSidebarOpen(false)
    setMainNavOpen(false)
  }, [location.pathname])

  const NavLink = ({ path, label, icon, active }) => (
    <Link
      to={path}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
      }`}
    >
      <span className="material-icons-outlined text-xl flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 flex font-sans antialiased">
      {/* Left Sidebar - Agent, RAG, Local VD, Profile, Logout */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-full w-64 flex-shrink-0 bg-white dark:bg-slate-900/95 dark:border-slate-800 border-r border-slate-200 shadow-xl lg:shadow-none flex flex-col transition-transform duration-300 ease-out backdrop-blur-xl ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-800">
          <Link to={isAdmin ? '/admin/dashboard' : isSenior ? '/user/dashboard' : '/user/checklist'} className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 dark:from-blue-500/30 dark:to-indigo-600/30 flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
              <span className="material-icons-outlined text-blue-600 dark:text-blue-400 text-2xl">balance</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate">Sanchalan.ai</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close sidebar"
          >
            <span className="material-icons-outlined">close</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {sidebarLinks.map((link) => (
            <NavLink key={link.path} path={link.path} label={link.label} icon={link.icon} active={isActive(link.path)} />
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <button
            onClick={() => navigate(user?.role === 'admin' ? '/admin/profile' : '/user/profile')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 text-left"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex flex-col items-start min-w-0 flex-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Welcome,</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white truncate w-full">{user?.username || 'User'}</span>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white text-sm font-semibold rounded-xl transition-all duration-200"
          >
            <span className="material-icons-outlined text-lg">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main content area: top bar + page */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar: hamburger (mobile) + main nav */}
        <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Open sidebar"
              >
                <span className="material-icons-outlined text-2xl">menu</span>
              </button>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400 lg:sr-only">
                {mainNavLinks.find((l) => isActive(l.path))?.label || 'Menu'}
              </span>
            </div>

            <nav className="hidden lg:flex items-center gap-1.5">
              {mainNavLinks.map((link) => (
                <NavLink key={link.path} path={link.path} label={link.label} icon={link.icon} active={isActive(link.path)} />
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setMainNavOpen(!mainNavOpen)}
                className="lg:hidden p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Toggle main menu"
              >
                <span className="material-icons-outlined text-2xl">apps</span>
              </button>
            </div>
          </div>

          {/* Mobile main nav dropdown */}
          {mainNavOpen && (
            <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="px-4 py-3 space-y-1">
                {mainNavLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMainNavOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
                      isActive(link.path) ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="material-icons-outlined text-xl">{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 w-full max-w-7xl mx-auto py-5 sm:py-6 lg:py-8 px-4 sm:px-6 lg:px-8 animate-fade-in">
          <Outlet />
        </main>
      </div>

      {user && chatbotConfig.enabled && <Chatbot title={chatbotConfig.title} />}
    </div>
  )
}

export default Layout
