import { useState, useEffect } from 'react'
import * as API from './api.js'
import { useAuth } from './AuthContext.jsx'

const inp = (x = {}) => ({
  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd',
  fontSize: 13, fontFamily: 'inherit', outline: 'none', ...x,
})
const btn = (bg, col = '#fff') => ({
  background: bg, color: col, border: 'none', borderRadius: 8,
  padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13,
})

const EMPTY_FORM = { username: '', password: '', displayName: '', role: 'user', active: true }

export default function AdminUserManager({ onClose }) {
  const { user: me } = useAuth()
  const [users,   setUsers]   = useState([])
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [editing, setEditing] = useState(null)   // userId being edited
  const [busy,    setBusy]    = useState(false)
  const [msg,     setMsg]     = useState({ text: '', type: '' })   // type: 'ok'|'err'

  const load = () => API.getUsers().then(setUsers).catch(() => {})
  useEffect(() => { load() }, [])

  const flash = (text, type = 'ok') => {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text: '', type: '' }), 3000)
  }

  const startEdit = (u) => {
    setEditing(u.id)
    setForm({ username: u.username, password: '', displayName: u.displayName, role: u.role, active: u.active })
  }
  const cancelEdit = () => { setEditing(null); setForm(EMPTY_FORM) }

  const handleSave = async () => {
    if (!form.username.trim()) return flash('Username is required', 'err')
    setBusy(true)
    try {
      if (editing) {
        const updates = { displayName: form.displayName, role: form.role, active: form.active }
        if (form.password) updates.password = form.password
        await API.updateUser(editing, updates)
        flash(`✅ User "${form.username}" updated`)
      } else {
        if (!form.password) return flash('Password is required', 'err')
        await API.createUser(form)
        flash(`✅ User "${form.username}" created`)
      }
      setEditing(null)
      setForm(EMPTY_FORM)
      await load()
    } catch (e) {
      flash(e.message, 'err')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (u) => {
    if (u.id === me.id) return flash('You cannot delete your own account', 'err')
    if (!window.confirm(`Delete user "${u.displayName}"? This also removes their billing data.`)) return
    setBusy(true)
    try {
      await API.deleteUser(u.id)
      flash(`🗑️ Deleted "${u.displayName}"`)
      if (editing === u.id) cancelEdit()
      await load()
    } catch (e) {
      flash(e.message, 'err')
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (u) => {
    if (u.id === me.id) return flash('You cannot deactivate yourself', 'err')
    await API.updateUser(u.id, { active: !u.active })
    await load()
    flash(`${!u.active ? '✅ Activated' : '⏸️ Deactivated'} "${u.displayName}"`)
  }

  const ROLE_CLR = { admin: { bg: '#e8eaf6', col: '#1a237e' }, user: { bg: '#e8f5e9', col: '#1b5e20' } }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9990, backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="fade-in" style={{ background: '#fff', borderRadius: 20, width: '95%', maxWidth: 760, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.35)', overflow: 'hidden' }}>

        {/* header */}
        <div style={{ background: 'linear-gradient(135deg,#1a237e,#3949ab)', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.1em' }}>👥 User Management</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>{users.length} users registered</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 800, fontSize: 18, cursor: 'pointer', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* flash message */}
          {msg.text && (
            <div className="slide-down" style={{ background: msg.type === 'ok' ? '#e8f5e9' : '#ffebee', border: `1px solid ${msg.type === 'ok' ? '#c8e6c9' : '#ffcdd2'}`, borderRadius: 8, padding: '10px 14px', color: msg.type === 'ok' ? '#2e7d32' : '#c62828', fontWeight: 600, fontSize: 13 }}>
              {msg.text}
            </div>
          )}

          {/* ── Add / Edit form ── */}
          <div style={{ background: editing ? '#fff8e1' : '#f8f9ff', borderRadius: 14, padding: '18px', border: `1.5px solid ${editing ? '#ffe082' : '#e8eaf6'}` }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#37474f', marginBottom: 14 }}>
              {editing ? '✏️ Edit User' : '➕ Add New User'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#777', display: 'block', marginBottom: 4, fontWeight: 600 }}>Display Name</label>
                <input style={inp()} placeholder="Full name" value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#777', display: 'block', marginBottom: 4, fontWeight: 600 }}>Username *</label>
                <input style={inp({ background: editing ? '#f5f5f5' : '#fff' })} placeholder="username" value={form.username}
                  readOnly={!!editing}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#777', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                  Password {editing ? '(leave blank to keep)' : '*'}
                </label>
                <input style={inp()} type="password" placeholder={editing ? 'New password…' : 'Set password'} value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#777', display: 'block', marginBottom: 4, fontWeight: 600 }}>Role</label>
                <select style={{ ...inp(), cursor: 'pointer' }} value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {editing && (
                <div>
                  <label style={{ fontSize: 12, color: '#777', display: 'block', marginBottom: 4, fontWeight: 600 }}>Status</label>
                  <select style={{ ...inp(), cursor: 'pointer' }} value={form.active ? 'true' : 'false'}
                    onChange={e => setForm(f => ({ ...f, active: e.target.value === 'true' }))}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={handleSave} disabled={busy} style={btn('linear-gradient(135deg,#1565c0,#1976d2)')}>
                {busy ? '⏳' : editing ? '💾 Save Changes' : '➕ Create User'}
              </button>
              {editing && <button onClick={cancelEdit} style={btn('#f5f5f5', '#555')}>Cancel</button>}
            </div>
          </div>

          {/* ── Users table ── */}
          <div style={{ borderRadius: 14, border: '1px solid #e8e8e8', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fb' }}>
                  {['User', 'Username', 'Role', 'Status', 'Created', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#555', borderBottom: '2px solid #e5e5e5', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f2f2f2', background: u.id === me.id ? '#fffde7' : u.active ? '#fff' : '#fafafa', opacity: u.active ? 1 : .6 }}
                    onMouseOver={e => e.currentTarget.style.background = '#f8f9ff'}
                    onMouseOut={e => e.currentTarget.style.background = u.id === me.id ? '#fffde7' : u.active ? '#fff' : '#fafafa'}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: u.role === 'admin' ? '#e8eaf6' : '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: u.role === 'admin' ? '#1a237e' : '#2e7d32' }}>
                          {u.displayName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#222' }}>{u.displayName}</div>
                          {u.id === me.id && <div style={{ fontSize: 10, color: '#f57f17', fontWeight: 600 }}>● You</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#555', fontFamily: 'monospace' }}>{u.username}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: ROLE_CLR[u.role]?.bg || '#f5f5f5', color: ROLE_CLR[u.role]?.col || '#333', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{u.role}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: u.active ? '#e8f5e9' : '#ffebee', color: u.active ? '#2e7d32' : '#c62828', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                        {u.active ? '✅ Active' : '⏸️ Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#888', fontSize: 12 }}>{u.createdAt?.slice(0, 10) || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => startEdit(u)} style={btn('#e8eaf6', '#1a237e')}>✏️ Edit</button>
                        {u.id !== me.id && (
                          <>
                            <button onClick={() => toggleActive(u)} style={btn(u.active ? '#fff3e0' : '#e8f5e9', u.active ? '#e65100' : '#2e7d32')}>
                              {u.active ? '⏸️' : '▶️'}
                            </button>
                            <button onClick={() => handleDelete(u)} style={btn('#ffebee', '#c62828')}>🗑️</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
