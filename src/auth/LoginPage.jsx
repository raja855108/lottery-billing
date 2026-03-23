import { useState } from 'react'
import { useAuth } from './AuthContext.jsx'

export default function LoginPage() {
  const { login, error, setError, loading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy]         = useState(false)
  const [showPw, setShowPw]     = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setBusy(true)
    await login(username.trim(), password)
    setBusy(false)
  }

  const inp = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid #d0d0d0', fontSize: 15,
    fontFamily: 'inherit', outline: 'none',
    background: '#fafafa', transition: 'border-color .2s',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#1a237e 0%,#283593 50%,#1565c0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="fade-in" style={{ background: '#fff', borderRadius: 24, padding: '44px 36px 36px', width: '100%', maxWidth: 400, boxShadow: '0 32px 80px rgba(0,0,0,0.35)' }}>
        {/* logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>🎲</div>
          <h1 style={{ fontSize: '1.55em', fontWeight: 900, color: '#1a237e', letterSpacing: .5 }}>Lottery Billing</h1>
          <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* username */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Username</label>
            <input
              style={inp}
              placeholder="Enter username"
              value={username}
              autoComplete="username"
              onChange={e => { setUsername(e.target.value); setError('') }}
              disabled={busy}
            />
          </div>

          {/* password */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inp, paddingRight: 44 }}
                type={showPw ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                autoComplete="current-password"
                onChange={e => { setPassword(e.target.value); setError('') }}
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#aaa', padding: 0 }}
              >
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* error */}
          {error && (
            <div className="slide-down" style={{ background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: 8, padding: '10px 14px', color: '#c62828', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚠️ {error}
            </div>
          )}

          {/* submit */}
          <button
            type="submit"
            disabled={busy || !username || !password}
            style={{ background: busy ? '#9fa8da' : 'linear-gradient(135deg,#1a237e,#3949ab)', color: '#fff', border: 'none', borderRadius: 11, padding: '14px', fontSize: 15, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', letterSpacing: .4, marginTop: 4, boxShadow: '0 4px 16px rgba(26,35,126,0.35)', transition: 'background .2s' }}
          >
            {busy ? '⏳ Signing in…' : '🔐 Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 22, fontSize: 12, color: '#bbb' }}>
          Contact your administrator to get access
        </p>
      </div>
    </div>
  )
}
