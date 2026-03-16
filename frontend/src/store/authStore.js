import { create } from 'zustand'

// Helper to get initial state from localStorage
const getInitialState = () => {
  const storedToken = localStorage.getItem('token')
  const storedUser = localStorage.getItem('user')
  
  return {
    user: storedUser ? JSON.parse(storedUser) : null,
    token: storedToken,
    isAuthenticated: !!(storedToken && storedUser),
  }
}

const useAuthStore = create((set) => ({
  ...getInitialState(),
  setAuth: (user, token) => {
    set({ user, token, isAuthenticated: true })
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  },
  logout: () => {
    set({ user: null, token: null, isAuthenticated: false })
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  },
  setUser: (user) => {
    set({ user, isAuthenticated: true })
    localStorage.setItem('user', JSON.stringify(user))
  },
}))

export default useAuthStore

