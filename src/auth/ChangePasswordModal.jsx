import { useState } from 'react'
import * as API from './api.js'

export default function ChangePasswordModal({ userId, onClose }) {
  const [oldPw,  setOldPw]  = useState('')
  const [newPw,  setNewPw]  = useState('')
  const [confPw, setConfPw] = useState('')
  const [busy,   setBusy]   = useState(false)
  const [err,    setErr]    = useState('')
  const [ok,     setOk]     = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setErr('')
    if (newPw.length < 4) return setErr('Password must be at least 4 characters')
    if (newPw !== confPw)  return setErr('New passwords do not match')
    setBusy(true)
    try {
      await API.changePassword(userId, oldPw, newPw)
      setOk(true)
      setTimeout(onClose, 1600)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const inp = { width: '100%', padding: '10px 13px', borderRadius: 9, border: '1.5px solid #ddd', fontSize: 14, fontFamily: 'inherit', outline: 'none' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9995, backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="fade-in" style={{ background: '#fff', borderRadius: 18, padding: '32px 28px', width: '92%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <h3 style={{ color: '#1a237e', marginBottom: 22, fontSize: '1.1em' }}>🔑 Change Password</h3>

        {ok
          ? <div style={{ textAlign: 'center', padding: '16px 0', color: '#2e7d32', fontWeight: 700, fontSize: 16 }}>✅ Password changed!</div>
          : (
            <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Current Password', val: oldPw,  set: setOldPw,  ph: 'Current password' },
                { label: 'New Password',      val: newPw,  set: setNewPw,  ph: 'At least 4 characters' },
                { label: 'Confirm New',       val: confPw, set: setConfPw, ph: 'Repeat new password' },
              ].map(({ label, val, set, ph }) => (
                <div key={label}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>{label}</label>
                  <input style={inp} type="password" placeholder={ph} value={val} onChange={e => { set(e.target.value); setErr('') }} disabled={busy} />
                </div>
              ))}
              {err && <div style={{ background: '#ffebee', borderRadius: 7, padding: '8px 12px', color: '#c62828', fontSize: 13, fontWeight: 600 }}>⚠️ {err}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="submit" disabled={busy} style={{ flex: 1, background: 'linear-gradient(135deg,#1a237e,#3949ab)', color: '#fff', border: 'none', borderRadius: 9, padding: '11px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  {busy ? '⏳' : '🔑 Update'}
                </button>
                <button type="button" onClick={onClose} style={{ flex: 1, background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 9, padding: '11px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          )}
      </div>
    </div>
  )
}
