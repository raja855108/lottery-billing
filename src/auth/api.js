/**
 * api.js — Auth API layer.
 * ──────────────────────────────────────────────────────────────
 * Currently backed by mockDB (localStorage).
 * To connect a real backend: replace each function with fetch().
 *
 * EXAMPLE — replacing login():
 *   export async function login(username, password) {
 *     const res  = await fetch('/api/auth/login', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({ username, password }),
 *       credentials: 'include',   // if using cookies
 *     })
 *     const data = await res.json()
 *     if (!res.ok) throw new Error(data.message)
 *     return { user: data.user, token: data.token }
 *   }
 *
 * Every function must resolve to the same shape shown below.
 * ──────────────────────────────────────────────────────────────
 */

import * as Mock from './mockDB.js'

const strip = ({ password, ...u }) => u   // never expose password to UI

// ── Session ────────────────────────────────────────────────────────────────
/** @returns {{ user, token } | null} */
export async function getSession() {
  const s = Mock.getSession()
  if (!s) return null
  const u = Mock.findUserById(s.userId)
  if (!u || !u.active) return null
  return { user: strip(u), token: s.token }
}

// ── Login ──────────────────────────────────────────────────────────────────
/** @returns {{ user: { id, username, role, displayName }, token: string }} */
export async function login(username, password) {
  const u = Mock.findUser(username, password)
  if (!u) throw new Error('Invalid username or password')
  const token = `tok_${u.id}_${Date.now()}`
  Mock.setSession({ token, userId: u.id })
  return { user: strip(u), token }
}

// ── Logout ─────────────────────────────────────────────────────────────────
export async function logout() {
  Mock.clearSession()
}

// ── Admin: list all users ──────────────────────────────────────────────────
/** @returns {User[]} */
export async function getUsers() {
  return Mock.getAllUsers().map(strip)
}

// ── Admin: create user ─────────────────────────────────────────────────────
/** @returns {User} */
export async function createUser(data) {
  if (Mock.findUserByUsername(data.username))
    throw new Error(`Username "${data.username}" already exists`)
  return strip(Mock.createUser(data))
}

// ── Admin: update user (name, role, active, password) ─────────────────────
/** @returns {User} */
export async function updateUser(id, updates) {
  const u = Mock.updateUser(id, updates)
  if (!u) throw new Error('User not found')
  return strip(u)
}

// ── Admin: delete user ─────────────────────────────────────────────────────
export async function deleteUser(id) {
  Mock.deleteUser(id)
}

// ── Change own password ────────────────────────────────────────────────────
export async function changePassword(userId, oldPw, newPw) {
  if (!Mock.changePassword(userId, oldPw, newPw))
    throw new Error('Current password is incorrect')
}
