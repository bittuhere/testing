// Arcade Hub — login (username or email + password, Google continue, legacy SHA-1 aware)
import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import SEO from '../components/SEO.jsx'
import { sfx } from '../services/sfx.js'
import { validateEmail, normalizeUsername } from '../utils/validation.js'
import { auth } from '../firebase.js'
import { isFirebaseConfigured } from '../config.js'
import { sendPasswordResetEmail } from 'firebase/auth'
import { Eye, EyeOff, LogIn, Loader2, ArrowRight, ShieldCheck, Sparkles, KeyRound } from 'lucide-react'

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.4 35.1 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.9l6.3 5.3C36.9 40 44 35 44 24c0-1.2-.1-2.6-.4-3.9z" />
    </svg>
  )
}
export { GoogleIcon }

export default function Login() {
  const { signInWithIdentifier, signInWithGoogle, profile } = useAuth()
  const { toast, prompt } = useUI()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.startsWith('/') ? location.state.from : '/'

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (profile) navigate(from, { replace: true }) }, [profile, navigate, from])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const id = identifier.trim()
    if (!id || !password) { setError('Enter your username/email and your password.'); return }
    setBusy(true)
    try {
      await signInWithIdentifier(id, password)
      sfx.coin()
      toast('Welcome back to the arcade!', 'success')
      navigate(from, { replace: true })
    } catch (err) {
      setError(err?.userMessage || 'Could not sign you in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const forgotPassword = async () => {
    // Firebase sends the reset email; in demo mode there is no mail server.
    if (!isFirebaseConfigured) {
      toast('Password reset emails need Firebase — ask the operator to reset it in the admin panel.', 'info')
      return
    }
    const seed = identifier.includes('@') ? identifier.trim() : ''
    const email = await prompt({
      title: 'Reset your password',
      message: 'We will email you a secure reset link. Enter the email you signed up with.',
      label: 'Email',
      placeholder: seed || 'you@example.com',
      defaultValue: seed,
      confirmText: 'Send reset link',
      validate: (v) => (validateEmail(v).ok ? null : 'Enter a valid email address.'),
    })
    if (!email) return
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase())
      toast('Reset link sent — check your inbox (and spam).', 'success')
      sfx.coin()
    } catch (err) {
      const code = err?.code || ''
      toast(
        code === 'auth/user-not-found' ? 'No account uses that email.' :
        'Could not send the reset email. Try again in a minute.',
        'error',
      )
    }
  }

  const google = async () => {
    setError('')
    setGoogleBusy(true)
    try {
      const { needsProfile } = await signInWithGoogle()
      if (needsProfile) navigate('/complete-profile', { replace: true })
      else { sfx.coin(); toast('Welcome back!', 'success'); navigate(from, { replace: true }) }
    } catch (err) {
      setError(err?.userMessage || 'Google sign-in failed.')
    } finally {
      setGoogleBusy(false)
    }
  }

  return (
    <div className="auth-split">
      <SEO title="Log in" path="login" />
      {/* Art panel */}
      <aside className="auth-art" aria-hidden="true">
        <img src={import.meta.env.BASE_URL + "assets/auth-cabinet.jpg"} alt="" />
        <div className="auth-art-overlay">
          <h2>The cabinet is warm.</h2>
          <p>Log in to keep your high scores, streaks and rivalries alive.</p>
        </div>
      </aside>

      {/* Form panel */}
      <div className="auth-form-side">
        <form className="auth-card" onSubmit={submit} noValidate>
          <span className="eyebrow">Welcome back</span>
          <h1>Log in to <span className="hl">Arcade Hub</span></h1>
          <p className="auth-sub">One account. Every cabinet. All your scores.</p>

          <button type="button" className="google-btn" onClick={google} disabled={googleBusy || busy}>
            {googleBusy ? <Loader2 size={19} className="spin" /> : <GoogleIcon />}
            Continue with Google
          </button>

          <div className="divider">or use your password</div>

          <label className="field-label" htmlFor="identifier">Username or email</label>
          <input
            id="identifier"
            className="field-input"
            placeholder="anurag_01 or you@example.com"
            value={identifier}
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => setIdentifier(e.target.value)}
            autoFocus
          />

          <label className="field-label" htmlFor="password">Password</label>
          <div className="password-wrap">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="field-input"
              placeholder="Your password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button type="button" className="link-btn forgot-link" onClick={forgotPassword}><KeyRound size={13} /> Forgot password?</button>

          {error && <p className="form-status error" role="alert">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy || googleBusy} style={{ marginTop: 16 }}>
            {busy ? <><Loader2 size={18} className="spin" /> Opening the cabinet…</> : <><LogIn size={18} /> Log in <ArrowRight size={17} /></>}
          </button>

          <p className="auth-footnote"><ShieldCheck size={13} /> Legacy account? We verify your old SHA-1 password and upgrade it to SHA-256 automatically on this login.</p>
          <p className="auth-switch">New to Arcade Hub? <Link to="/signup">Create a free account <Sparkles size={13} /></Link></p>
        </form>
      </div>
    </div>
  )
}
