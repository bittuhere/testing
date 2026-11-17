// Arcade Hub — after Google sign-in, collect username + password (required by design)
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import SEO from '../components/SEO.jsx'
import { GoogleIcon } from './Login.jsx'
import { validateUsername, validatePassword, normalizeUsername, passwordStrength } from '../utils/validation.js'
import { sfx } from '../services/sfx.js'
import {
  User, Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle, Check, X, ArrowRight,
} from 'lucide-react'

export default function CompleteProfile() {
  const { completeGoogleProfile, profile, usernameAvailable } = useAuth()
  const { toast } = useUI()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [usernameState, setUsernameState] = useState('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const strength = useMemo(() => passwordStrength(password), [password])
  const usernameCheck = useMemo(() => validateUsername(username), [username])

  // If the user already has a profile, there's nothing to complete
  useEffect(() => {
    if (profile) navigate('/', { replace: true })
  }, [profile, navigate])

  // Debounced availability
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!username) { setUsernameState('idle'); return }
      if (!validateUsername(username).ok) { setUsernameState('invalid'); return }
      setUsernameState('checking')
      try {
        const free = await usernameAvailable(normalizeUsername(username))
        setUsernameState(free ? 'ok' : 'taken')
      } catch { setUsernameState('ok') }
    }, 350)
    return () => clearTimeout(t)
  }, [username, usernameAvailable])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const vUser = validateUsername(username)
    if (!vUser.ok) return setError(vUser.error)
    if (usernameState === 'taken') return setError('That username is already taken.')
    const vPass = validatePassword(password)
    if (!vPass.ok) return setError(vPass.error)
    if (password !== confirmPassword) return setError('Passwords do not match.')
    setBusy(true)
    try {
      const result = await completeGoogleProfile({ username: vUser.value, password })
      sfx.win()
      if (result?.passwordLinked === false) {
        toast('Profile complete! Heads up: your password couldn’t be set on this Google account — sign in with “Continue with Google” (or try setting the password again later).', 'info')
      } else {
        toast('Profile complete — welcome to the arcade!', 'success')
      }
      navigate('/', { replace: true })
    } catch (err) {
      setError(err?.userMessage || 'Could not complete your profile. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-split">
      <SEO title="Choose your username" path="complete-profile" />
      <aside className="auth-art" aria-hidden="true">
        <img src={import.meta.env.BASE_URL + "assets/auth-cabinet.jpg"} alt="" />
        <div className="auth-art-overlay">
          <h2>Almost there.</h2>
          <p>Google got you through the door — now pick your arcade identity.</p>
        </div>
      </aside>

      <div className="auth-form-side">
        <form className="auth-card" onSubmit={submit} noValidate>
          <span className="eyebrow"><GoogleIcon /> Signed in with Google</span>
          <h1>Claim your <span className="hl">username</span></h1>
          <p className="auth-sub">Every Arcade Hub account needs a unique username and a password — even Google players. It takes 30 seconds.</p>

          <label className="field-label" htmlFor="cp-username">Username <span className="req">*</span></label>
          <div className="username-wrap">
            <User size={18} className="field-icon" />
            <input
              id="cp-username"
              className={`field-input has-icon ${usernameState === 'taken' || usernameState === 'invalid' ? 'field-error' : ''}`}
              placeholder="anurag_01"
              value={username}
              maxLength={20}
              autoCapitalize="off"
              spellCheck={false}
              autoFocus
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
            />
            <span className="username-status">
              {usernameState === 'checking' && <Loader2 size={17} className="spin" />}
              {usernameState === 'ok' && <Check size={18} className="status-ok" />}
              {(usernameState === 'taken' || usernameState === 'invalid') && <X size={18} className="status-bad" />}
            </span>
          </div>
          {usernameState === 'ok' && <p className="field-ok-text">@{username} is available.</p>}
          {usernameState === 'taken' && <p className="field-error-text">That username is already taken.</p>}
          {usernameState === 'invalid' && username && <p className="field-error-text">{usernameCheck.error}</p>}

          <label className="field-label" htmlFor="cp-password">Password <span className="req">*</span></label>
          <div className="password-wrap">
            <Lock size={18} className="field-icon" />
            <input
              id="cp-password"
              type={showPassword ? 'text' : 'password'}
              className="field-input has-icon"
              placeholder="At least 4 characters"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {password && (
            <div className="strength-meter" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="strength-bar"><span className="fill" style={{ width: strength.score > i ? '100%' : '0%', background: ['#FF5A5A', '#FF8A3D', '#FFD34D', '#00E0A4', '#3BD6FF'][Math.min(4, Math.max(0, strength.score - 1))] }} /></span>
              ))}
              <span className="strength-label">{strength.label}</span>
            </div>
          )}

          <label className="field-label" htmlFor="cp-confirm">Confirm password <span className="req">*</span></label>
          <input
            id="cp-confirm"
            type={showPassword ? 'text' : 'password'}
            className={`field-input ${confirmPassword && confirmPassword !== password ? 'field-error' : ''}`}
            placeholder="Type it again"
            value={confirmPassword}
            autoComplete="new-password"
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {confirmPassword && confirmPassword !== password && <p className="field-error-text">Passwords do not match.</p>}

          {error && <p className="form-status error" role="alert"><AlertTriangle size={15} style={{ verticalAlign: -3, marginRight: 6 }} />{error}</p>}

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy} style={{ marginTop: 16 }}>
            {busy ? <><Loader2 size={18} className="spin" /> Locking in your identity…</> : <><CheckCircle2 size={18} /> Enter the arcade <ArrowRight size={16} /></>}
          </button>
          <p className="auth-switch">Changed your mind? <Link to="/login">Back to login</Link></p>
        </form>
      </div>
    </div>
  )
}

