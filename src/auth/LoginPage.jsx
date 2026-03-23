import { useState } from 'react'
import { useAuth } from './AuthContext.jsx'

export default function LoginPage() {
  const { login, register, loginWithGoogle, error, setError } = useAuth()
  
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [displayName, setDisplayName] = useState('')
  
  const [busy, setBusy]             = useState(false)
  const [showPw, setShowPw]         = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    
    setBusy(true)
    let ok = false
    if (isRegister) {
      ok = await register(email.trim(), password, displayName.trim())
    } else {
      ok = await login(email.trim(), password)
    }
    setBusy(false)
  }

  const handleGoogle = async () => {
    setBusy(true)
    await loginWithGoogle()
    setBusy(false)
  }

  const inp = {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    border: '1.5px solid #e0e0e0', fontSize: 15,
    fontFamily: 'inherit', outline: 'none',
    background: '#fcfcfc', transition: 'all .2s',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#1a237e 0%,#283593 50%,#1565c0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="fade-in" style={{ background: '#fff', borderRadius: 28, padding: '48px 40px 40px', width: '100%', maxWidth: 420, boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>
        
        {/* logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>🎲</div>
          <h1 style={{ fontSize: '1.7em', fontWeight: 950, color: '#1a237e', letterSpacing: -0.5 }}>
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
            {isRegister ? 'Join the Lottery Billing System' : 'Sign in to manage your bills'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          
          {/* Display Name (Register only) */}
          {isRegister && (
            <div className="slide-down">
              <label style={{ fontSize: 13, fontWeight: 700, color: '#444', display: 'block', marginBottom: 6 }}>Full Name</label>
              <input
                style={inp}
                placeholder="Ex. John Doe"
                value={displayName}
                onChange={e => { setDisplayName(e.target.value); setError('') }}
                disabled={busy}
              />
            </div>
          )}

          {/* Email / Username */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#444', display: 'block', marginBottom: 6 }}>
              {isRegister ? 'Email Address' : 'Email or Username'}
            </label>
            <input
              style={inp}
              type="text"
              placeholder={isRegister ? "name@example.com" : "Enter email or username"}
              value={email}
              autoComplete="username"
              onChange={e => { setEmail(e.target.value); setError('') }}
              disabled={busy}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#444', display: 'block', marginBottom: 6 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inp, paddingRight: 44 }}
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                autoComplete={isRegister ? "new-password" : "current-password"}
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

          {/* Error Message */}
          {error && (
            <div className="slide-down" style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 12, padding: '12px 14px', color: '#c53030', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>⚠️</span> {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={busy || !email || !password}
            style={{ 
              background: busy ? '#9fa8da' : 'linear-gradient(135deg,#1a237e,#3949ab)', 
              color: '#fff', border: 'none', borderRadius: 14, padding: '15px', 
              fontSize: 16, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', 
              letterSpacing: 0.5, marginTop: 6, boxShadow: '0 8px 20px rgba(26,35,126,0.25)', 
              transition: 'all .2s', transform: busy ? 'scale(0.98)' : 'none'
            }}
          >
            {busy ? 'Processing...' : isRegister ? '🚀 Create Account' : '🔐 Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
          <span style={{ fontSize: 12, color: '#aaa', fontWeight: 600, textTransform: 'uppercase' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
        </div>

        {/* Google Login */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          style={{ 
            width: '100%', background: '#fff', color: '#444', 
            border: '1.5px solid #e0e0e0', borderRadius: 14, padding: '13px', 
            fontSize: 15, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            transition: 'all .2s', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#f9f9f9'}
          onMouseOut={e => e.currentTarget.style.background = '#fff'}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" alt="G" />
          Continue with Google
        </button>

        {/* Toggle Mode */}
        <p style={{ textAlign: 'center', marginTop: 28, fontSize: 14, color: '#666' }}>
          {isRegister ? 'Already have an account?' : "Don't have an account?"}
          <button 
            type="button"
            onClick={() => { setIsRegister(!isRegister); setError('') }}
            style={{ background: 'none', border: 'none', color: '#1565c0', fontWeight: 800, cursor: 'pointer', marginLeft: 6, textDecoration: 'underline' }}
          >
            {isRegister ? 'Sign In' : 'Register Now'}
          </button>
        </p>

      </div>
    </div>
  )
}
