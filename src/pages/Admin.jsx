// Arcade Hub — operator admin panel
// Sections: Overview · Users · Leaderboards · Notifications · Moderation · Inbox · Settings
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import SEO from '../components/SEO.jsx'
import Avatar from '../components/Avatar.jsx'
import { LEADERBOARD_GAMES } from '../data/games.js'
import { getLeaderboard, getProfileByUsername } from '../services/db.js'
import * as admin from '../services/db.js'
import {
  LayoutDashboard, Users, Trophy, Megaphone, ShieldAlert, Inbox, Settings,
  Loader2, Search, Download, Ban, MessageSquareOff, Trash2, ShieldCheck,
  Send, Globe2, Lock, Wrench, Save, AlertTriangle, UserRoundX,
} from 'lucide-react'
import { sfx } from '../services/sfx.js'

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'leaderboards', label: 'Leaderboards', icon: Trophy },
  { id: 'notifications', label: 'Notifications', icon: Megaphone },
  { id: 'moderation', label: 'Moderation', icon: ShieldAlert },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function Admin() {
  const { isOperator } = useAuth()
  const { toast, confirm } = useUI()
  const [section, setSection] = useState('overview')
  const [stats, setStats] = useState(null)
  const [lbSnapshot, setLbSnapshot] = useState(null)

  const refreshStats = useCallback(async () => {
    try {
      const [s, lb] = await Promise.all([admin.adminStats(), admin.adminLeaderboardSnapshot()])
      setStats(s); setLbSnapshot(lb)
    } catch (e) { toast(e?.userMessage || 'Could not load admin stats.', 'error') }
  }, [toast])

  useEffect(() => { refreshStats() }, [refreshStats])

  if (!isOperator) return null

  return (
    <div className="page container">
      <SEO title="Admin Panel" description="Arcade Hub operator console." path="admin" />
      <div className="page-head">
        <div>
          <span className="eyebrow">Operator console</span>
          <h1 className="page-title">Admin <span className="hl">Panel</span></h1>
          <p className="page-sub">Full control: players, boards, broadcasts, moderation, site health. With great power…</p>
        </div>
        <span className="chip chip-leaderboard"><ShieldCheck size={13} /> Operator mode</span>
      </div>

      <div className="admin-layout">
        <nav className="admin-nav" aria-label="Admin sections">
          {SECTIONS.map((s) => (
            <button key={s.id} className={section === s.id ? 'active' : ''} onClick={() => { setSection(s.id); sfx.click() }}>
              <s.icon size={17} /> {s.label}
            </button>
          ))}
        </nav>

        <div className="admin-content">
          {section === 'overview' && <Overview stats={stats} lbSnapshot={lbSnapshot} onRefresh={refreshStats} />}
          {section === 'users' && <UsersSection />}
          {section === 'leaderboards' && <LeaderboardsSection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'moderation' && <ModerationSection />}
          {section === 'inbox' && <InboxSection />}
          {section === 'settings' && <SettingsSection />}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── Overview ─────────────────────────── */
function Overview({ stats, lbSnapshot, onRefresh }) {
  if (!stats) return <div className="page-loading"><Loader2 size={28} className="spin" /><p>Crunching the numbers…</p></div>
  const cards = [
    { b: stats.users, s: 'total players' },
    { b: stats.online, s: 'online now' },
    { b: stats.banned, s: 'banned' },
    { b: stats.plays, s: 'ranked runs' },
    { b: stats.scoreEntries, s: 'leaderboard entries' },
    { b: stats.messagesToday, s: 'messages (24h)' },
    { b: stats.flagged, s: 'flagged messages' },
    { b: stats.contact, s: 'contact messages' },
  ]
  return (
    <div>
      <div className="stat-cards">
        {cards.map((c, i) => <div key={i} className="stat-card"><b>{c.b}</b><span>{c.s}</span></div>)}
      </div>
      <div className="panel">
        <div className="mini-lb-head">
          <h4>Leaderboard snapshot</h4>
          <button className="tiny-btn" onClick={onRefresh}>Refresh</button>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Game</th><th>Entries</th><th>Total plays</th><th>Top score</th></tr></thead>
            <tbody>
              {LEADERBOARD_GAMES.map((g) => {
                const s = lbSnapshot?.[g.id]
                return <tr key={g.id}><td>{g.name}</td><td>{s?.entries ?? 0}</td><td>{s?.plays ?? 0}</td><td>{s?.top ?? 0}</td></tr>
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── Users ─────────────────────────── */
function UsersSection() {
  const { toast, confirm } = useUI()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async (q = '') => {
    setLoading(true)
    try { setUsers(await admin.adminListUsers({ search: q, max: 80 })) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load('') }, [load])

  const exportCsv = useCallback(() => {
    const header = 'username,email,role,banned,muted,created\n'
    const rows = users.map((u) => [u.username, u.email, u.role, u.banned, u.muted, new Date(u.createdAt || 0).toISOString()].join(',')).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'arcade-hub-users.csv'; a.click()
    URL.revokeObjectURL(url)
    toast(`Exported ${users.length} users to CSV.`, 'success')
  }, [users, toast])

  return (
    <div className="panel">
      <div className="admin-toolbar">
        <form className="drive-search" style={{ flex: 1 }} onSubmit={(e) => { e.preventDefault(); load(search) }}>
          <Search size={18} />
          <input className="field-input" placeholder="Search by username or email…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" />
        </form>
        <button className="btn btn-ghost btn-sm" onClick={exportCsv}><Download size={15} /> CSV</button>
        <button className="btn btn-ghost btn-sm" onClick={() => load(search)}>Refresh</button>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Player</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5}><div className="page-loading" style={{ minHeight: 80 }}><Loader2 size={22} className="spin" /></div></td></tr>}
            {!loading && users.map((u) => (
              <tr key={u.uid} className={u.banned ? 'banned-row' : ''}>
                <td>
                  <span className="lb-user"><Avatar name={u.username} color={u.avatarColor} size={28} /><span>@{u.username}<small className="email-sub">{u.email}</small></span></span>
                </td>
                <td>{u.role === 'operator' ? <span className="status-pill status-active">operator</span> : 'player'}</td>
                <td>{u.banned ? <span className="status-pill status-banned">banned</span> : u.muted ? <span className="status-pill status-muted">muted</span> : <span className="status-pill status-active">active</span>}</td>
                <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                <td>
                  <div className="row-actions">
                    <button className="tiny-btn warn" title={u.banned ? 'Unban' : 'Ban'} onClick={async () => {
                      const yes = await confirm({ title: u.banned ? `Unban @${u.username}?` : `Ban @${u.username}?`, message: u.banned ? 'They regain full access immediately.' : 'They will be locked out of chat, scoring and friends.', confirmText: u.banned ? 'Unban' : 'Ban', tone: u.banned ? 'primary' : 'danger' })
                      if (!yes) return
                      await admin.adminSetBanned(u.uid, !u.banned)
                      toast(u.banned ? 'Player unbanned.' : 'Player banned.', 'success')
                      load(search)
                    }}><Ban size={13} /></button>
                    <button className="tiny-btn" title={u.muted ? 'Unmute' : 'Mute chat'} onClick={async () => { await admin.adminSetMuted(u.uid, !u.muted); toast(u.muted ? 'Chat unmuted.' : 'Chat muted.', 'success'); load(search) }}>
                      <MessageSquareOff size={13} />
                    </button>
                    <button className="tiny-btn danger" title="Delete player data" onClick={async () => {
                      const typed = await prompt2(confirm, u.username)
                      if (!typed) return
                      await admin.adminDeleteUser(u.uid)
                      toast('Player record deleted.', 'success')
                      load(search)
                    }}><UserRoundX size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 && <tr><td colSpan={5}><p className="field-hint" style={{ padding: 18 }}>No players match that search.</p></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
// helper: destructive confirm that requires typing the username
async function prompt2(confirm, username) {
  return confirm({
    title: `Delete @${username}?`,
    message: 'This removes their profile, secrets and leaderboard identity from Arcade Hub. This cannot be undone.',
    confirmText: 'Delete forever', tone: 'danger',
  })
}

/* ─────────────────────────── Leaderboards ─────────────────────────── */
function LeaderboardsSection() {
  const { toast, confirm } = useUI()
  const [game, setGame] = useState('flappy')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setEntries(await getLeaderboard(game, 100)) } finally { setLoading(false) }
  }, [game])

  useEffect(() => { load() }, [load])

  return (
    <div className="panel">
      <div className="lb-tabs" style={{ marginBottom: 14 }}>
        {LEADERBOARD_GAMES.map((g) => (
          <button key={g.id} className={`lb-tab ${game === g.id ? 'active' : ''}`} onClick={() => setGame(g.id)}>{g.name}</button>
        ))}
        <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={async () => {
          const yes = await confirm({ title: 'Nuke this board?', message: 'Every entry for this game is deleted permanently. This cannot be undone.', confirmText: 'Clear leaderboard', tone: 'danger' })
          if (!yes) return
          await admin.adminClearLeaderboard(game)
          toast('Leaderboard cleared.', 'success')
          load()
        }}><Trash2 size={14} /> Clear board</button>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>#</th><th>Player</th><th>Best</th><th>Plays</th><th></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5}><div className="page-loading" style={{ minHeight: 60 }}><Loader2 size={20} className="spin" /></div></td></tr>}
            {!loading && entries.map((e, i) => (
              <tr key={e.uid}>
                <td className="lb-rank">#{i + 1}</td>
                <td><span className="lb-user"><Avatar name={e.username} color={e.avatarColor} size={24} />@{e.username}</span></td>
                <td className="lb-score" style={{ textAlign: 'left' }}>{e.best}</td>
                <td>{e.plays ?? '—'}</td>
                <td><button className="tiny-btn danger" title="Delete entry" onClick={async () => { await admin.adminDeleteLeaderboardEntry(game, e.uid); toast('Entry deleted.', 'success'); load() }}><Trash2 size={13} /></button></td>
              </tr>
            ))}
            {!loading && entries.length === 0 && <tr><td colSpan={5}><p className="field-hint" style={{ padding: 16 }}>Empty board — a fresh legend is waiting.</p></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─────────────────────────── Notifications ─────────────────────────── */
function NotificationsSection() {
  const { toast } = useUI()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targets, setTargets] = useState('')
  const [busy, setBusy] = useState(false)

  const broadcast = async (e) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return toast('Title and message are both required.', 'error')
    setBusy(true)
    try {
      await admin.sendGlobalNotification({ title: title.trim(), body: body.trim() })
      toast('Global broadcast sent to every player.', 'success')
      setTitle(''); setBody('')
    } catch (err) { toast(err?.userMessage || 'Broadcast failed.', 'error') } finally { setBusy(false) }
  }

  const sendPrivate = async (e) => {
    e.preventDefault()
    const names = targets.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
    if (!title.trim() || !body.trim()) return toast('Title and message are both required.', 'error')
    if (!names.length) return toast('List at least one username.', 'error')
    setBusy(true)
    try {
      const found = [], missing = []
      for (const n of names) {
        const p = await getProfileByUsername(n)
        if (p) found.push(p.uid); else missing.push(n)
      }
      if (found.length) await admin.sendPrivateNotification({ targetUids: found, title: title.trim(), body: body.trim() })
      toast(`Private message sent to ${found.length} player${found.length === 1 ? '' : 's'}${missing.length ? ` — not found: ${missing.join(', ')}` : ''}`, found.length ? 'success' : 'error')
      if (!missing.length) { setTargets(''); setTitle(''); setBody('') }
    } catch (err) { toast(err?.userMessage || 'Send failed.', 'error') } finally { setBusy(false) }
  }

  return (
    <div className="admin-notif-grid">
      <form className="panel" onSubmit={broadcast}>
        <h3 className="side-title"><Globe2 size={17} /> Broadcast to everyone</h3>
        <p className="field-hint">Lands in every player&apos;s notification feed (global) — maintenance notes, tourneys, special events.</p>
        <label className="field-label" htmlFor="notif-title">Title</label>
        <input id="notif-title" className="field-input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Maintenance tonight at 11…" />
        <label className="field-label" htmlFor="notif-body">Message</label>
        <textarea id="notif-body" className="field-input" rows={3} maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What should every player know?" />
        <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={busy}><Send size={16} /> Send global broadcast</button>
      </form>

      <form className="panel" onSubmit={sendPrivate}>
        <h3 className="side-title"><Lock size={17} /> Private message</h3>
        <p className="field-hint">Target specific players — only they will ever see it. Separate usernames with commas.</p>
        <label className="field-label" htmlFor="notif-targets">Usernames</label>
        <input id="notif-targets" className="field-input" value={targets} onChange={(e) => setTargets(e.target.value)} placeholder="anurag, bittuhere, player_two" />
        <label className="field-label" htmlFor="notif-title-2">Title</label>
        <input id="notif-title-2" className="field-input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="You have been selected…" />
        <label className="field-label" htmlFor="notif-body-2">Message</label>
        <textarea id="notif-body-2" className="field-input" rows={3} maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Private intel for these players only…" />
        <button className="btn btn-secondary btn-block" style={{ marginTop: 14 }} disabled={busy}><Send size={16} /> Send private message</button>
      </form>
    </div>
  )
}

/* ─────────────────────────── Moderation ─────────────────────────── */
function ModerationSection() {
  const { toast, confirm } = useUI()
  const [flagged, setFlagged] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setFlagged(await admin.adminFlaggedMessages(60)) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="panel">
      <div className="mini-lb-head">
        <h4>Flagged by the abuse filter ({flagged.length})</h4>
        <button className="tiny-btn" onClick={load}>Refresh</button>
      </div>
      <p className="field-hint" style={{ marginBottom: 12 }}>Messages that tripped the profanity filter. Delete offenders, then mute repeat abusers from the Users tab.</p>
      {loading ? (
        <div className="page-loading" style={{ minHeight: 80 }}><Loader2 size={22} className="spin" /></div>
      ) : flagged.length === 0 ? (
        <p className="field-hint" style={{ padding: '12px 4px' }}>No flagged messages. The arcade stays civil tonight.</p>
      ) : (
        <div className="flag-list">
          {flagged.map((m) => (
            <div key={m.id} className="flag-row">
              <div className="flag-meta"><strong>@{m.fromName}</strong> · {new Date(m.ts).toLocaleString('en-IN')} · <span className="flag-hits">{(m.hits || []).join(', ')}</span></div>
              <p className="flag-text">{m.text}</p>
              <button className="tiny-btn danger" onClick={async () => {
                const yes = await confirm({ title: 'Delete this message?', message: 'It disappears for everyone, everywhere.', confirmText: 'Delete', tone: 'danger' })
                if (!yes) return
                await admin.deleteMessage(m)
                toast('Flagged message deleted.', 'success')
                load()
              }}><Trash2 size={13} /> Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── Inbox (contact) ─────────────────────────── */
function InboxSection() {
  const { toast } = useUI()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    admin.adminContactMessages(40).then(setMessages).catch(() => toast('Could not load contact messages.', 'error')).finally(() => setLoading(false))
  }, [toast])

  return (
    <div className="panel">
      <h3 className="side-title"><Inbox size={17} /> Contact messages</h3>
      <p className="field-hint" style={{ marginBottom: 12 }}>A copy of every message sent through the Contact form (these also arrive by email at anurag670singh@gmail.com).</p>
      {loading ? (
        <div className="page-loading" style={{ minHeight: 80 }}><Loader2 size={22} className="spin" /></div>
      ) : messages.length === 0 ? (
        <p className="field-hint">No messages yet.</p>
      ) : (
        <div className="flag-list">
          {messages.map((m) => (
            <details key={m.id} className="inbox-item">
              <summary>
                <span className="inbox-subject">{m.subject || '(no subject)'}</span>
                <span className="inbox-from">{m.name} · {m.email} · {new Date(m.ts).toLocaleDateString('en-IN')}</span>
              </summary>
              <p className="inbox-body">{m.message}</p>
              <a className="btn btn-ghost btn-sm" href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject || 'Arcade Hub')}`}>Reply via email</a>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── Settings ─────────────────────────── */
function SettingsSection() {
  const { toast } = useUI()
  const [settings, setSettings] = useState(null)
  const [announcement, setAnnouncement] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    admin.getSiteSettings().then((s) => { setSettings(s); setAnnouncement(s.announcement || '') }).catch(() => {})
  }, [])

  if (!settings) return <div className="page-loading"><Loader2 size={24} className="spin" /></div>

  const saveAnnouncement = async () => {
    setBusy(true)
    try {
      const next = await admin.setSiteSettings({ announcement: announcement.trim() })
      setSettings(next)
      toast(announcement.trim() ? 'Announcement is live.' : 'Announcement cleared.', 'success')
    } catch (err) { toast(err?.userMessage || 'Save failed.', 'error') } finally { setBusy(false) }
  }

  const toggleMaintenance = async () => {
    setBusy(true)
    try {
      const next = await admin.setSiteSettings({ maintenance: !settings.maintenance })
      setSettings(next)
      toast(next.maintenance ? 'Maintenance mode ON — players see the splash screen.' : 'Maintenance mode OFF — the arcade is open.', 'success')
    } catch (err) { toast(err?.userMessage || 'Toggle failed.', 'error') } finally { setBusy(false) }
  }

  return (
    <div className="panel settings-panel">
      <h3 className="side-title"><Settings size={17} /> Site controls</h3>
      <p className="field-hint" style={{ marginBottom: 4 }}>Changes apply instantly for every visitor (settings are polled every 30 seconds).</p>

      <div className="settings-block">
        <div className="settings-row">
          <div>
            <strong>Maintenance mode</strong>
            <p className="field-hint">Shows a “down for maintenance” splash to everyone except operators.</p>
          </div>
          <button className={`toggle ${settings.maintenance ? 'on' : ''}`} onClick={toggleMaintenance} role="switch" aria-checked={settings.maintenance} disabled={busy} aria-label="Toggle maintenance mode">
            <span className="toggle-knob" />
          </button>
        </div>
        {settings.maintenance && <p className="form-status error"><AlertTriangle size={15} /> Maintenance is currently ON.</p>}
      </div>

      <div className="settings-block">
        <label className="field-label" htmlFor="announcement">Site-wide announcement</label>
        <p className="field-hint" style={{ marginBottom: 8 }}>Shown as a dismissable banner under the navbar for all visitors. Leave empty to hide it.</p>
        <textarea id="announcement" className="field-input" rows={2} maxLength={220} value={announcement} onChange={(e) => setAnnouncement(e.target.value)} placeholder="e.g. Snake tournament on Sunday — top 3 win shout-outs!" />
        <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={saveAnnouncement} disabled={busy}><Save size={15} /> {announcement.trim() ? 'Save announcement' : 'Clear announcement'}</button>
      </div>

      <div className="settings-block">
        <strong>Operator accounts</strong>
        <p className="field-hint">These usernames always receive operator rights:</p>
        <div className="operator-list">
          <code>anurag</code> <code>bittuhere</code>
        </div>
        <p className="field-hint" style={{ marginTop: 8 }}>Change this list in <code>src/config.js</code> → <code>operators</code>.</p>
      </div>
    </div>
  )
}
