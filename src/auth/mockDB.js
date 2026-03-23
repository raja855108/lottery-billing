/**
 * mockDB.js — simulates a user database via localStorage.
 * ─────────────────────────────────────────────────────
 * TO CONNECT A REAL DATABASE: delete this file and update
 * src/auth/api.js to call your real backend endpoints.
 *
 * User schema:
 *   { id, username, password, displayName, role, createdAt, active }
 */

const USERS_KEY   = 'auth_users'
const SESSION_KEY = 'auth_session'

const _get = (k, fb) => { try { const d = localStorage.getItem(k); return d ? JSON.parse(d) : fb } catch { return fb } }
const _set = (k, v)  => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

// Seed a default admin account on first run
;(function seed() {
  if (_get(USERS_KEY, null) !== null) return
  _set(USERS_KEY, [{
    id: 'user_admin',
    username: 'admin',
    password: 'admin123',
    displayName: 'Administrator',
    role: 'admin',
    createdAt: new Date().toISOString(),
    active: true,
  }])
})()

export const getAllUsers        = ()       => _get(USERS_KEY, [])
export const findUserById       = (id)     => getAllUsers().find(u => u.id === id) ?? null
export const findUserByUsername = (uname)  => getAllUsers().find(u => u.username === uname) ?? null
export const findUser           = (u, pw)  => getAllUsers().find(x => x.username === u && x.password === pw && x.active) ?? null

export function createUser({ username, password, displayName, role }) {
  const all  = getAllUsers()
  const user = {
    id: `user_${Date.now()}`,
    username, password,
    displayName: displayName || username,
    role: role || 'user',
    createdAt: new Date().toISOString(),
    active: true,
  }
  _set(USERS_KEY, [...all, user])
  return user
}

export function updateUser(id, updates) {
  const all = getAllUsers()
  const idx = all.findIndex(u => u.id === id)
  if (idx < 0) return null
  const { id: _id, ...safe } = updates            // never overwrite id
  all[idx] = { ...all[idx], ...safe }
  _set(USERS_KEY, all)
  return all[idx]
}

export function deleteUser(id) {
  _set(USERS_KEY, getAllUsers().filter(u => u.id !== id))
  // wipe their billing data too
  ;['db_sellers_', 'db_stockers_', 'db_meta_'].forEach(k => {
    try { localStorage.removeItem(k + id) } catch {}
  })
}

export function changePassword(userId, oldPw, newPw) {
  const all = getAllUsers()
  const idx = all.findIndex(u => u.id === userId && u.password === oldPw)
  if (idx < 0) return false
  all[idx].password = newPw
  _set(USERS_KEY, all)
  return true
}

export const getSession   = ()  => _get(SESSION_KEY, null)
export const setSession   = (s) => _set(SESSION_KEY, s)
export const clearSession = ()  => { try { localStorage.removeItem(SESSION_KEY) } catch {} }
