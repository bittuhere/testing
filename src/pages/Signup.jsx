// Arcade Hub — signup with verified email code (Google Apps Script) + Google continue
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import SEO from '../components/SEO.jsx'
import { GoogleIcon } from './Login.jsx'
import { validateUsername, validateEmail, validatePassword, normalizeUsername, passwordStrength } from '../utils/validation.js'
import { sendEmailCode, verifyEmailCode } from '../services/emailCodes.js'
import { isFirebaseConfigured } from '../config.js'
import { sfx } from '../services/sfx.js'
import {
  User, Mail, Lock, Eye, EyeOff, Loader2, UserPlus, ShieldCheck, CheckCircle2,
  ChevronLeft, RefreshCw, AlertTriangle, Check, X,
} from 'lucide-react'

export default function Signup() {
  const { signUpWithEmail, signInWithGoogle, usernameAvailable } = useAuth()
  const { toast } = useUI()
  const navigate = useNavigate()

  const [step, setStep] = useState('form') // form | verify
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agree, setAgree] = useState(false)
  const [usernameState, setUsernameState] = useState('idle') // idle | checking | ok | taken | invalid
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const availabilityTimer = useRef(null)

  const strength = useMemo(() => passwordStrength(password), [password])
  const usernameCheck = useMemo(() => validateUsername(username), [username])

  // Debounced username availability + validity check
  useEffect(() => {
    clearTimeout(availabilityTimer.current)
    if (!username) { setUsernameState('idle'); return }
    if (!usernameCheck.ok) { setUsernameState('invalid'); return }
    setUsernameState('checking')
    availabilityTimer.current = setTimeout(async () => {
      try {
        const free = await usernameAvailable(usernameCheck.value)
        setUsernameState(free ? 'ok' : 'taken')
      } catch { setUsernameState('ok') } // offline → don't block; server enforces on submit
    }, 380)
    return () => clearTimeout(availabilityTimer.current)
  }, [username, usernameCheck.ok, usernameCheck.value, usernameAvailable])

  // Resend cooldown ticker
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [resendCooldown])

  const startSignup = async (e) => {
    e?.preventDefault()
    setError('')
    const vUser = validateUsername(username)
    if (!vUser.ok) return setError(vUser.error)
    if (usernameState === 'taken') return setError('That username is already taken — pick another.')
    const vEmail = validateEmail(email)
    if (!vEmail.ok) return setError(vEmail.error)
    const vPass = validatePassword(password)
    if (!vPass.ok) return setError(vPass.error)
    if (password !== confirmPassword) return setError('Passwords do not match.')
    if (!agree) return setError('You must accept the Terms of Use and Privacy Policy.')

    setBusy(true)
    try {
      if (!isFirebaseConfigured) {
        // Local demo mode — email codes are skipped
        await signUpWithEmail({ username: vUser.value, email: vEmail.value, password })
        sfx.coin()
        toast('Account created (demo mode — data stays in this browser).', 'success')
        navigate('/', { replace: true })
        return
      }
      await sendEmailCode(vEmail.value)
      setStep('verify')
      setResendCooldown(45)
      setCode('')
      setCodeError('')
      toast('Verification code sent — check your inbox.', 'success')
    } catch (err) {
      setError(err?.userMessage || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const confirmSignup = async (e) => {
    e?.preventDefault()
    setCodeError('')
    const cleaned = code.replace(/\D/g, '')
    if (cleaned.length !== 6) return setCodeError('Enter the 6-digit code from your inbox.')
    setBusy(true)
    try {
      await verifyEmailCode(email, cleaned)
      await signUpWithEmail({ username: normalizeUsername(username), email: email.trim().toLowerCase(), password })
      sfx.win()
      toast('Welcome to Arcade Hub — account verified and ready!', 'success')
      navigate('/', { replace: true })
    } catch (err) {
      setCodeError(err?.userMessage || 'That code did not work. Try again or resend.')
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    if (resendCooldown > 0) return
    setCodeError('')
    try {
      await sendEmailCode(email.trim().toLowerCase())
      setResendCooldown(45)
      toast('Fresh code sent.', 'success')
    } catch (err) {
      setCodeError(err?.userMessage || 'Could not resend the code.')
    }
  }

  const google = async () => {
    setError('')
    setGoogleBusy(true)
    try {
      const { needsProfile } = await signInWithGoogle()
      if (needsProfile) navigate('/complete-profile', { replace: true })
      else { sfx.coin(); toast('Welcome back!', 'success'); navigate('/', { replace: true }) }
    } catch (err) {
      setError(err?.userMessage || 'Google sign-in failed.')
    } finally {
      setGoogleBusy(false)
    }
  }

  /* ───────────────────── VERIFY STEP ───────────────────── */
  if (step === 'verify') {
    return (
      <div className="auth-split">
        <SEO title="Verify your email" path="signup" />
        <aside className="auth-art" aria-hidden="true">
          <img src={import.meta.env.BASE_URL + "assets/auth-cabinet.jpg"} alt="" />
          <div className="auth-art-overlay">
            <h2>One last step.</h2>
            <p>Proof you own that inbox — then the whole arcade is yours.</p>
          </div>
        </aside>
        <div className="auth-form-side">
          <form className="auth-card" onSubmit={confirmSignup} noValidate>
            <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={() => setStep('form')}><ChevronLeft size={16} /> Back</button>
            <span className="eyebrow">Check your inbox</span>
            <h1>Enter the <span className="hl">6-digit code</span></h1>
            <p className="auth-sub">We sent a one-time code to <strong>{email}</strong>. It expires in 10 minutes.</p>

            <label className="field-label" htmlFor="verify-code">Verification code</label>
            <input
              id="verify-code"
              className={`field-input verify-input ${codeError ? 'field-error' : ''}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              autoFocus
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setCodeError('') }}
            />
            {codeError && <p className="field-error-text" role="alert">{codeError}</p>}

            <div className="code-sent-note"><ShieldCheck size={17} /> Never share this code. Arcade Hub staff will never ask for it — not even “for verification”.</div>

            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy || code.length !== 6} style={{ marginTop: 16 }}>
              {busy ? <><Loader2 size={18} className="spin" /> Verifying…</> : <><CheckCircle2 size={18} /> Verify &amp; create account</>}
            </button>
            <div className="verify-foot">
              <button type="button" className="link-btn" onClick={resend} disabled={resendCooldown > 0}>
                <RefreshCw size={13} /> {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
              </button>
              <button type="button" className="link-btn" onClick={() => setStep('form')}>Wrong email? Change it</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  /* ───────────────────── FORM STEP ───────────────────── */
  return (
    <div className="auth-split">
      <SEO title="Create your account" path="signup" />
      <aside className="auth-art" aria-hidden="true">
        <img src={import.meta.env.BASE_URL + "assets/auth-cabinet.jpg"} alt="" />
        <div className="auth-art-overlay">
          <h2>Insert coin. Free.</h2>
          <p>One account unlocks every cabinet, the leaderboard and your friends&apos; trash talk.</p>
        </div>
      </aside>

      <div className="auth-form-side">
        <form className="auth-card" onSubmit={startSignup} noValidate>
          <span className="eyebrow">New player</span>
          <h1>Create your <span className="hl">free account</span></h1>
          <p className="auth-sub">Lowercase letters, numbers and one underscore for your username — max 20 characters.</p>

          <button type="button" className="google-btn" onClick={google} disabled={googleBusy || busy}>
            {googleBusy ? <Loader2 size={19} className="spin" /> : <GoogleIcon />}
            Continue with Google
          </button>
          <div className="divider">or sign up with email</div>

          {/* Username */}
          <label className="field-label" htmlFor="signup-username">Username <span className="req">*</span></label>
          <div className="username-wrap">
            <User size={18} className="field-icon" />
            <input
              id="signup-username"
              className={`field-input has-icon ${usernameState === 'taken' || usernameState === 'invalid' ? 'field-error' : ''}`}
              placeholder="anurag_01"
              value={username}
              maxLength={20}
              autoCapitalize="off"
              autoComplete="username"
              spellCheck={false}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
            />
            <span className="username-status">
              {usernameState === 'checking' && <Loader2 size={17} className="spin" />}
              {usernameState === 'ok' && <Check size={18} className="status-ok" />}
              {(usernameState === 'taken' || usernameState === 'invalid') && <X size={18} className="status-bad" />}
            </span>
          </div>
          {usernameState === 'invalid' && username.length > 0 && <p className="field-error-text">{usernameCheck.error}</p>}
          {usernameState === 'taken' && <p className="field-error-text">That username is already taken.</p>}
          {usernameState === 'ok' && <p className="field-ok-text">@{normalizeUsername(username)} is yours for the taking.</p>}
          <p className="field-hint">We auto-lowercase everything — no caps needed.</p>

          {/* Email */}
          <label className="field-label" htmlFor="signup-email">Email <span className="req">*</span></label>
          <div className="username-wrap">
            <Mail size={18} className="field-icon" />
            <input
              id="signup-email"
              type="email"
              className="field-input has-icon"
              placeholder="you@example.com"
              value={email}
              autoComplete="email"
              autoCapitalize="off"
              spellCheck={false}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <p className="field-hint">Only used to send your one-time verification code. Never shown publicly.</p>

          {/* Password */}
          <label className="field-label" htmlFor="signup-password">Password <span className="req">*</span></label>
          <div className="password-wrap">
            <Lock size={18} className="field-icon" />
            <input
              id="signup-password"
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

          <label className="field-label" htmlFor="signup-confirm">Confirm password <span className="req">*</span></label>
          <input
            id="signup-confirm"
            type={showPassword ? 'text' : 'password'}
            className={`field-input ${confirmPassword && confirmPassword !== password ? 'field-error' : ''}`}
            placeholder="Type it again"
            value={confirmPassword}
            autoComplete="new-password"
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {confirmPassword && confirmPassword !== password && <p className="field-error-text">Passwords do not match.</p>}

          <label className="agree-row">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I agree to the <Link to="/terms">Terms of Use</Link> and <Link to="/privacy">Privacy Policy</Link>. My username is unique and mine alone.</span>
          </label>

          {error && <p className="form-status error" role="alert"><AlertTriangle size={15} style={{ verticalAlign: -3, marginRight: 6 }} />{error}</p>}

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy || googleBusy} style={{ marginTop: 14 }}>
            {busy ? <><Loader2 size={18} className="spin" /> Sending code…</> : <><UserPlus size={18} /> {isFirebaseConfigured ? 'Send verification code' : 'Create account (demo mode)'}</>}
          </button>

          <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
        </form>
      </div>
    </div>
  )
}
