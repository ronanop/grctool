import { useEffect } from 'react'
import { useNavigate, Outlet } from 'react-router-dom'
import useAuthStore from '../store/authStore'

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    const state = useAuthStore.getState()
    if (!state.isAuthenticated || !state.user) {
      navigate('/login', { replace: true })
      return
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(state.user.role)) {
      navigate('/login', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount to prevent redirect loop
  }, [])

  if (!isAuthenticated || !user) {
    return null
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return null
  }

  return <Outlet />
}

export default ProtectedRoute

