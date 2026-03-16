import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import useAuthStore from './store/authStore'
import { initializeDarkMode } from './lib/darkMode'

// Redirect once on mount only (empty deps) to avoid effect re-run loop.
function RootRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    const state = useAuthStore.getState()
    const to = state.isAuthenticated && state.user ? getUserDefaultRoute(state.user) : '/login'
    navigate(to, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run once on mount
  }, [])
  return null
}

// When on /login and already authenticated, redirect once on mount only (empty deps) to avoid any effect re-run loop.
function LoginRoute() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  useEffect(() => {
    const state = useAuthStore.getState()
    if (state.isAuthenticated && state.user) {
      navigate(getUserDefaultRoute(state.user), { replace: true })
    }
    // Run only once on mount; after login, Login page's own effect handles redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: prevent redirect loop
  }, [])
  if (!isAuthenticated) return <Login />
  return null
}

import Login from './pages/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminQuestions from './pages/admin/Questions'
import AdminISOControls from './pages/admin/ISOControls'
import AdminUsers from './pages/admin/Users'
import AdminDepartments from './pages/admin/Departments'
import AdminPolicies from './pages/admin/Policies'
import AdminAgents from './pages/admin/Agents'
import RAGDocuments from './pages/admin/RAGDocuments'
import LocalVD from './pages/admin/LocalVD'
import ComplianceFrameworks from './pages/admin/ComplianceFrameworks'
import AdminProfile from './pages/admin/Profile'
import UserChecklist from './pages/user/Checklist'
import SeniorDashboard from './pages/user/SeniorDashboard'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

// Helper function to determine user's default route
const getUserDefaultRoute = (user) => {
  if (!user) return '/login'
  if (user.role === 'admin') return '/admin/dashboard'
  
  // Check if user is senior
  const isSenior = user.is_senior === true || user.isSenior === true || user.is_senior === 1
  if (isSenior) return '/user/dashboard'
  
  return '/user/checklist'
}

function App() {
  // Initialize dark mode on app load
  useEffect(() => {
    initializeDarkMode()
  }, [])

  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<Layout />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/departments" element={<AdminDepartments />} />
            <Route path="/admin/compliance-frameworks" element={<ComplianceFrameworks />} />
            <Route path="/admin/iso-controls" element={<AdminISOControls />} />
            <Route path="/admin/questions" element={<AdminQuestions />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/policies" element={<AdminPolicies />} />
            <Route path="/admin/agents" element={<AdminAgents />} />
            <Route path="/admin/rag-documents" element={<RAGDocuments />} />
            <Route path="/admin/local-vd" element={<LocalVD />} />
            <Route path="/admin/profile" element={<AdminProfile />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['user', 'admin']} />}>
          <Route element={<Layout />}>
            <Route path="/user/checklist" element={<UserChecklist />} />
            <Route path="/user/dashboard" element={<SeniorDashboard />} />
          </Route>
        </Route>

        <Route path="/" element={<RootRedirect />} />
      </Routes>
    </Router>
  )
}

export default App

