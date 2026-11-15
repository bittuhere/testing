// Arcade Hub — friends: search, request, accept/decline, presence, quick actions
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listFriends, listFriendRequests, sendFriendRequest, respondFriendRequest, removeFriend,
} from '../services/db.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import SEO from '../components/SEO.jsx'
import Avatar from '../components/Avatar.jsx'
import { normalizeUsername, validateUsername } from '../utils/validation.js'
import { sfx } from '../services/sfx.js'
import {
  UserPlus, UserCheck, UserX, Users, Search, Loader2, MessageSquare, Swords, Trash2,
  Gamepad2, Inbox, CheckCheck,
} from 'lucide-react'

export default function Friends() {
  const { profile, refreshBadges } = useAuth()
  const { toast, confirm } = useUI()
  const [friends, setFriends] = useState([])
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [f, reqs] = await Promise.all([listFriends(), listFriendRequests()])
      setFriends(f)
      setIncoming(reqs.incoming)
      setOutgoing(reqs.outgoing)
    } catch {
      toast('Could not load your friends right now.', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadAll() }, [loadAll])

  const addFriend = useCallback(async (e) => {
    e?.preventDefault()
    const v = validateUsername(normalizeUsername(search))
    if (!v.ok) { toast(v.error, 'error'); return }
    setAdding(true)
    try {
      await sendFriendRequest(v.value)
      toast(`Friend request sent to @${v.value}`, 'success')
      setSearch('')
      sfx.coin()
      loadAll()
    } catch (err) {
      toast(err?.userMessage || 'Could not send that request.', 'error')
    } finally {
      setAdding(false)
    }
  }, [search, toast, loadAll])

  const respond = useCallback(async (id, accept) => {
    try {
      await respondFriendRequest(id, accept)
      toast(accept ? 'Friend added! Welcome to the rivalry.' : 'Request declined.', accept ? 'success' : 'info')
      sfx.click()
      refreshBadges()
      loadAll()
    } catch (err) {
      toast(err?.userMessage || 'Could not update that request.', 'error')
    }
  }, [toast, loadAll, refreshBadges])

  const remove = useCallback(async (friend) => {
    const yes = await confirm({ title: `Remove @${friend.username}?`, message: 'You can always add them again later with a fresh request.', confirmText: 'Remove', tone: 'danger' })
    if (!yes) return
    try {
      await removeFriend(friend.uid)
      toast(`@${friend.username} removed from friends.`, 'info')
      loadAll()
    } catch (err) {
      toast(err?.userMessage || 'Could not remove friend.', 'error')
    }
  }, [confirm, toast, loadAll])

  const onlineCount = friends.filter((f) => f.online).length

  return (
    <div className="page container">
      <SEO title="Friends" description="Add friends on Arcade Hub, accept requests and see who is online right now." path="friends" />
      <div className="page-head">
        <div>
          <span className="eyebrow">Your crew</span>
          <h1 className="page-title">Friends &amp; <span className="hl">Rivals</span></h1>
          <p className="page-sub">{friends.length} friend{friends.length === 1 ? '' : 's'} · <span className="online-count">{onlineCount} online now</span></p>
        </div>
        <Link to="/chat" className="btn btn-secondary btn-sm"><MessageSquare size={16} /> Open chat</Link>
      </div>

      <div className="friends-grid">
        {/* ── Left: add + requests ── */}
        <div className="friends-left">
          <div className="panel">
            <h3 className="side-title"><UserPlus size={17} /> Add a friend</h3>
            <p className="field-hint" style={{ marginBottom: 10 }}>Enter their exact Arcade Hub username (lowercase, one underscore max).</p>
            <form className="add-friend-row" onSubmit={addFriend}>
              <div className="drive-search" style={{ flex: 1 }}>
                <Search size={17} />
                <input
                  className="field-input"
                  placeholder="e.g. anurag_01"
                  value={search}
                  maxLength={20}
                  onChange={(e) => setSearch(e.target.value.toLowerCase())}
                  aria-label="Friend's username"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={adding || !search.trim()}>
                {adding ? <Loader2 size={17} className="spin" /> : <UserPlus size={17} />} Send
              </button>
            </form>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <h3 className="side-title"><Inbox size={17} /> Requests {incoming.length > 0 && <span className="req-badge">{incoming.length}</span>}</h3>
            {loading && <div className="page-loading" style={{ minHeight: 60 }}><Loader2 size={20} className="spin" /></div>}
            {!loading && incoming.length === 0 && outgoing.length === 0 && (
              <p className="field-hint">No pending requests. Your inbox is as clean as a freshly swept arcade floor.</p>
            )}
            {incoming.map((req) => (
              <div key={req.id} className="friend-row">
                <Avatar name={req.fromName} color={req.avatarColor} size={42} />
                <div className="friend-row-info">
                  <b>@{req.fromName}</b>
                  <small>Wants to be your rival</small>
                </div>
                <button className="tiny-btn accept" onClick={() => respond(req.id, true)} title="Accept"><UserCheck size={16} /></button>
                <button className="tiny-btn danger" onClick={() => respond(req.id, false)} title="Decline"><UserX size={16} /></button>
              </div>
            ))}
            {outgoing.map((req) => (
              <div key={req.id} className="friend-row outgoing">
                <Avatar name={req.toName || '?'} color="#3BD6FF" size={42} />
                <div className="friend-row-info">
                  <b>Waiting for a reply…</b>
                  <small>Request sent — hang tight</small>
                </div>
                <CheckCheck size={18} className="outgoing-tick" />
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: friend list ── */}
        <div className="panel friends-right">
          <h3 className="side-title"><Users size={17} /> Your friends</h3>
          {loading && <div className="page-loading" style={{ minHeight: 120 }}><Loader2 size={24} className="spin" /></div>}
          {!loading && friends.length === 0 && (
            <div className="channel-empty" style={{ padding: '34px 10px' }}>
              <Gamepad2 size={36} strokeWidth={1.4} />
              <p><strong>Your crew is empty.</strong><br />Add friends by username — challenge them to Tic-Tac-Toe, trash talk in chat, climb the board together.</p>
            </div>
          )}
          {friends.map((f) => (
            <div key={f.uid} className="friend-row">
              <Avatar name={f.username} color={f.avatarColor} size={46} className="friend-avatar" />
              <div className="friend-row-info">
                <b><span className={`presence-dot ${f.online ? 'online' : ''}`} /> @{f.username}</b>
                <small>{f.online ? 'Online now' : 'Offline'}{f.favoriteGame ? ` · Loves ${f.favoriteGame}` : ''}</small>
              </div>
              <Link to={`/chat`} className="tiny-btn" title="Open chat"><MessageSquare size={15} /></Link>
              <Link to="/game/tictactoe" className="tiny-btn" title="Challenge to Tic-Tac-Toe"><Swords size={15} /></Link>
              <button className="tiny-btn danger" onClick={() => remove(f)} title="Remove friend"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
