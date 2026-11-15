// Arcade Hub — contact page (FormSubmit delivery + local copy for the admin inbox)
import { useState } from 'react'
import SEO from '../components/SEO.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { saveContactMessage } from '../services/db.js'
import { Mail, Send, Loader2, CheckCircle2, MessageSquareWarning, LifeBuoy, Bug } from 'lucide-react'
import CONFIG from '../config.js'

const SUBJECTS = ['General question', 'Bug report', 'Fair Copies / content issue', 'Account & login problem', 'Leaderboard dispute', 'Business / ads', 'Other']

// Lucide has no GitHub brand icon — inline the octocat mark.
function GithubMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.463 2 11.97c0 4.404 2.865 8.14 6.839 9.458.5.092.682-.215.682-.477 0-.236-.009-.862-.013-1.692-2.782.603-3.369-1.34-3.369-1.34-.454-1.152-1.11-1.46-1.11-1.46-.908-.62.069-.608.069-.608 1.003.07 1.531 1.029 1.531 1.029.892 1.527 2.341 1.086 2.91.83.092-.645.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.03-2.683-.103-.253-.447-1.27.098-2.646 0 0 .84-.269 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.295 2.747-1.027 2.747-1.027.546 1.376.202 2.393.1 2.646.64.7 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.308.678.916.678 1.846 0 1.333-.012 2.408-.012 2.736 0 .264.18.573.688.476C19.138 20.107 22 16.373 22 11.971 22 6.463 17.523 2 12 2z" />
    </svg>
  )
}

export default function Contact() {
  const { profile } = useAuth()
  const { toast } = useUI()
  const [form, setForm] = useState({ name: profile?.username || '', email: profile?.email || '', subject: SUBJECTS[0], message: '', website: '' })
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [errorText, setErrorText] = useState('')

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (form.website) return // honeypot — bots please leave
    const name = form.name.trim(), email = form.email.trim(), message = form.message.trim()
    if (!name || !email || !message) { toast('Please fill in your name, email and message.', 'error'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { toast('That email address looks invalid.', 'error'); return }
    if (message.length < 10) { toast('Give us a sentence or two more so we can help.', 'error'); return }

    setStatus('sending')
    try {
      // 1) Deliver by email via FormSubmit (first ever send triggers a one-time activation email)
      const res = await fetch(`https://formsubmit.co/ajax/${CONFIG.contactEmail}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name, email, _subject: `[Arcade Hub] ${form.subject}`, message,
          _template: 'table', _captcha: 'false',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.success === 'false') throw new Error(data?.message || 'FormSubmit refused the message')
      // 2) Keep a copy in Arcade Hub so the operator sees it in the admin inbox
      await saveContactMessage({ name, email, subject: form.subject, message }).catch(() => {})
      setStatus('sent')
    } catch (err) {
      console.error('[Contact] FormSubmit failed:', err)
      setErrorText('The delivery service could not be reached. Your message was NOT sent — please email anurag670singh@gmail.com directly instead.')
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="page container">
        <SEO title="Message received" path="contact" />
        <div className="confirmation-card">
          <CheckCircle2 size={56} strokeWidth={1.6} />
          <h1>Message received loud &amp; clear</h1>
          <p>Thanks, <strong>{form.name.split(' ')[0]}</strong>! Your note is on its way to the operator. Expect a reply within a couple of days — sooner if the cabinets aren&apos;t busy.</p>
          <a className="btn btn-primary" href="#/">Back to the arcade</a>
        </div>
      </div>
    )
  }

  return (
    <div className="page container">
      <SEO title="Contact Us" description="Questions, bugs, leaderboard disputes or Fair Copies issues — reach the Arcade Hub operator." path="contact" />
      <div className="page-head">
        <div>
          <span className="eyebrow">We answer</span>
          <h1 className="page-title">Contact <span className="hl">the Operator</span></h1>
          <p className="page-sub">Bugs, missing PDFs, unfair leaderboard placements, partnership ideas — shoot your shot.</p>
        </div>
      </div>

      <div className="contact-grid">
        {/* Form */}
        <form className="panel contact-form" onSubmit={submit} noValidate>
          <div className="contact-row">
            <div>
              <label className="field-label" htmlFor="c-name">Your name <span className="req">*</span></label>
              <input id="c-name" className="field-input" value={form.name} onChange={update('name')} placeholder="e.g. Anurag Singh" required />
            </div>
            <div>
              <label className="field-label" htmlFor="c-email">Email <span className="req">*</span></label>
              <input id="c-email" type="email" className="field-input" value={form.email} onChange={update('email')} placeholder="you@example.com" required />
            </div>
          </div>
          <label className="field-label" htmlFor="c-subject">What&apos;s this about?</label>
          <select id="c-subject" className="field-input" value={form.subject} onChange={update('subject')}>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label className="field-label" htmlFor="c-message">Message <span className="req">*</span></label>
          <textarea id="c-message" className="field-input" rows={6} maxLength={2000} value={form.message} onChange={update('message')} placeholder="Tell us everything — steps to reproduce bugs, file names for Fair Copies requests, score disputes with dates…" required />
          <div className="char-count">{form.message.length}/2000</div>
          {/* Honeypot — invisible to humans */}
          <input className="hp-field" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={update('website')} />
          {status === 'error' && <p className="form-status error">{errorText}</p>}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={status === 'sending'} style={{ marginTop: 16 }}>
            {status === 'sending' ? <><Loader2 size={19} className="spin" /> Transmitting…</> : <><Send size={18} /> Send message</>}
          </button>
          <p className="field-hint" style={{ marginTop: 10, textAlign: 'center' }}>Delivered via FormSubmit to anurag670singh@gmail.com · a copy is kept in the admin inbox · replies within ~48h.</p>
        </form>

        {/* Aside */}
        <aside className="contact-aside">
          <div className="panel contact-card">
            <Mail size={22} />
            <h3>Direct email</h3>
            <a href="mailto:anurag670singh@gmail.com">anurag670singh@gmail.com</a>
          </div>
          <div className="panel contact-card">
            <GithubMark size={22} />
            <h3>Source &amp; issues</h3>
            <a href="https://github.com/bittuhere" target="_blank" rel="noreferrer">github.com/bittuhere</a>
          </div>
          <div className="panel contact-card">
            <Bug size={22} />
            <h3>Bug reports</h3>
            <p>Include your browser, device, and what you clicked. Screenshots help enormously.</p>
          </div>
          <div className="panel contact-card">
            <LifeBuoy size={22} />
            <h3>Account help</h3>
            <p>Forgot your password? Email from your registered address with your username and the operator will reset it.</p>
          </div>
          <div className="panel contact-card">
            <MessageSquareWarning size={22} />
            <h3>Report a player</h3>
            <p>Name the account, the game, and what happened. Chat logs from the last 14 days are reviewable.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
