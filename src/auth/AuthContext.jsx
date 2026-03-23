import { createContext, useContext, useEffect, useState } from 'react'
import * as API from './api.js'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  // restore session on page load
  useEffect(() => {
    API.getSession()
      .then(s => { if (s) setUser(s.user) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const login = async (username, password) => {
    setError('')
    try {
      const { user: u } = await API.login(username, password)
      setUser(u)
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }

  const logout = async () => {
    await API.logout()
    setUser(null)
  }

  return (
    <Ctx.Provider value={{
      user, loading, error, setError,
      login, logout,
      isAdmin: user?.role === 'admin',
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
