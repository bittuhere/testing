// Arcade Hub — notifications: operator broadcasts + targeted private messages
// Game invites deep-link straight into the room.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { listMyNotifications, markNotificationsRead } from '../services/db.js'
import { pushSupported, enablePushNotifications } from '../services/fcm.js'
import { useAuth } from '../context/AuthContext.jsx'
import SEO from '../components/SEO.jsx'
import { Megaphone, Lock, Gamepad2, BellOff, CheckCheck, Loader2, Bell, BellRing } from 'lucide-react'
import { sfx } from '../services/sfx.js'
import { useUI } from '../context/UIContext.jsx'

const dayLabel = (ts) => {
  const d = new Date(ts)
  const now = new Date()
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return `Today · ${time}`
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return `Yesterday · ${time}`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Notifications() {
  const { profile, unreadNotif, refreshBadges } = useAuth()
  const { toast } = useUI()
  const [pushBusy, setPushBusy] = useState(false)
  const [pushDone, setPushDone] = useState(() => localStorage.getItem('ah.push.enabled') === '1')
  const [tab, setTab] = useState('all') // all | global | private
  const [data, setData] = useState({ global: [], private: [] })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const enablePush = async () => {
    setPushBusy(true)
    const result = await enablePushNotifications()
    setPushBusy(false)
    if (result.ok) {
      localStorage.setItem('ah.push.enabled', '1')
      setPushDone(true)
      toast('Push notifications enabled — game invites will buzz you.', 'success')
      sfx.coin()
    } else {
      toast(result.reason || 'Push could not be enabled.', 'error')
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await listMyNotifications(80)) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const markAll = useCallback(async (scope) => {
    await markNotificationsRead(scope)
    await refreshBadges()
    await load()
    sfx.click()
  }, [refreshBadges, load])

  const visible = useMemo(() => {
    if (tab === 'global') return data.global.map((n) => ({ ...n, scope: 'global' }))
    if (tab === 'private') return data.private.map((n) => ({ ...n, scope: 'private' }))
    return [...data.global.map((n) => ({ ...n, scope: 'global' })), ...data.private.map((n) => ({ ...n, scope: 'private' }))].sort((a, b) => b.ts - a.ts)
  }, [data, tab])

  const isUnread = (n) => !(n.readBy || []).includes(profile?.uid)

  const handleInvite = async (n) => {
    await markNotificationsRead('private')
    refreshBadges()
    if (n.gameId && n.roomCode) navigate(`/game/${n.gameId}?room=${n.roomCode}`)
  }

  return (
    <div className="page container">
      <SEO title="Notifications" description="Arcade Hub notifications — global broadcasts from the operator and private messages sent just for you." path="notifications" />
      <div className="page-head">
        <div>
          <span className="eyebrow">Your inbox</span>
          <h1 className="page-title">Notifications <span className="hl">{unreadNotif > 0 ? `(${unreadNotif})` : ''}</span></h1>
          <p className="page-sub"><strong>Global</strong> = announcements from the operator to every player. <strong>Private</strong> = messages or game invites meant only for you.</p>
        </div>
        <div className="notif-head-actions">
          {pushSupported() && (
            <button className="btn btn-ghost btn-sm" onClick={enablePush} disabled={pushBusy || pushDone} title={pushDone ? 'Push notifications are on for this device' : 'Get buzzed instantly when a friend invites you to a game'}>
              {pushBusy ? <Loader2 size={15} className="spin" /> : pushDone ? <BellRing size={15} /> : <Bell size={15} />}
              {pushDone ? 'Push on' : 'Enable push'}
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => markAll(tab === 'all' ? 'all' : tab)}><CheckCheck size={16} /> Mark all as read</button>
        </div>
      </div>

      <div className="lb-tabs" role="tablist">
        {['all', 'global', 'private'].map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`lb-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'all' ? <Bell size={14} /> : t === 'global' ? <Megaphone size={14} /> : <Lock size={14} />}
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="page-loading"><Loader2 size={28} className="spin" /><p>Checking the wire…</p></div>
      ) : visible.length === 0 ? (
        <div className="drive-empty">
          <BellOff size={46} strokeWidth={1.4} />
          <h3>All quiet on the arcade front</h3>
          <p>Global broadcasts and private invites will land here. Invite a friend to a multiplayer game to test it out!</p>
          <Link to="/friends" className="btn btn-secondary" style={{ marginTop: 14 }}>Go to Friends</Link>
        </div>
      ) : (
        <div className="notif-list">
          {visible.map((n) => {
            const unread = isUnread(n)
            const invite = n.type === 'invite'
            return (
              <article key={n.id} className={`notif-card ${unread ? 'unread' : ''}`}>
                <div className={`notif-icon ${invite ? 'invite' : n.scope === 'private' ? 'private' : ''}`}>
                  {invite ? <Gamepad2 size={20} /> : n.scope === 'global' ? <Megaphone size={20} /> : <Lock size={20} />}
                </div>
                <div className="notif-body">
                  <div className="notif-head">
                    <strong>{n.title}</strong>
                    <span className="notif-time">{dayLabel(n.ts)}</span>
                  </div>
                  <p>{n.body}</p>
                  <div className="notif-foot">
                    <span className={`notif-scope ${n.scope}`}>{n.scope === 'global' ? 'GLOBAL · from operator' : invite ? 'GAME INVITE' : 'PRIVATE'} · by {n.createdBy}</span>
                    {invite && n.roomCode && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleInvite(n)}>Join game <span className="room-code">{n.roomCode}</span></button>
                    )}
                  </div>
                </div>
                {unread && <span className="unread-dot" aria-label="Unread" />}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
