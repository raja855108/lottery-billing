import { createContext, useContext, useEffect, useState } from 'react'
import * as API from './api.js'
import { initDB } from '../DB.js'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  // restore session on page load
  useEffect(() => {
    API.getSession()
      .then(async s => { 
        if (s) {
          await initDB(s.user.id)
          setUser(s.user)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const login = async (username, password) => {
    setError('')
    try {
      const { user: u } = await API.login(username, password)
      await initDB(u.id)
      setUser(u)
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }

  const register = async (email, password, displayName) => {
    setError('')
    try {
      const { user: u } = await API.register(email, password, displayName)
      await initDB(u.id)
      setUser(u)
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }

  const loginWithGoogle = async () => {
    setError('')
    try {
      const { user: u } = await API.loginWithGoogle()
      await initDB(u.id)
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
      login, register, loginWithGoogle, logout,
      isAdmin: user?.role === 'admin',
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
