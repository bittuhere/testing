// Arcade Hub — global chat + direct messages (abuse-filtered, seen/unseen, 14-day expiry)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  GLOBAL_CHANNEL, dmChannelId, subscribeMessages, sendMessage, markChannelRead,
  deleteMessage, listFriends, sendGameInvite,
} from '../services/db.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import SEO from '../components/SEO.jsx'
import Avatar from '../components/Avatar.jsx'
import { GAMES } from '../data/games.js'
import { getSocket, isSocketConfigured, emitAck } from '../services/socket.js'
import { sfx } from '../services/sfx.js'
import {
  MessagesSquare, Users, Send, Trash2, ShieldCheck, Clock3, Globe2, Swords, Loader2, Check, CheckCheck,
} from 'lucide-react'

const MULTIPLAYER_GAMES = GAMES.filter((g) => g.category === 'multiplayer')

function dayLabel(ts) {
  const d = new Date(ts), now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const y = new Date(now); y.setDate(now.getDate() - 1)
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `Today · ${time}`
  if (d.toDateString() === y.toDateString()) return `Yesterday · ${time}`
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${time}`
}

export default function Chat() {
  const { profile, isOperator, refreshBadges } = useAuth()
  const { toast, confirm } = useUI()
  const navigate = useNavigate()
  const [friends, setFriends] = useState([])
  const [friendsLoading, setFriendsLoading] = useState(true)
  const [activeChannel, setActiveChannel] = useState(GLOBAL_CHANNEL)
  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [inviteGame, setInviteGame] = useState(MULTIPLAYER_GAMES[0]?.id || '')
  const listRef = useRef(null)

  const activeFriend = useMemo(
    () => (activeChannel.startsWith('dm:') ? friends.find((f) => dmChannelId(profile.uid, f.uid) === activeChannel) : null),
    [activeChannel, friends, profile.uid]
  )

  useEffect(() => {
    listFriends().then(setFriends).catch(() => setFriends([])).finally(() => setFriendsLoading(false))
  }, [])

  // Subscribe to the active channel
  useEffect(() => {
    setLoadingMessages(true)
    const unsub = subscribeMessages(activeChannel, (msgs) => {
      setMessages(msgs)
      setLoadingMessages(false)
      // Mark read after paint so the badge clears
      markChannelRead(activeChannel).then(() => refreshBadges())
    }, 120)
    return unsub
  }, [activeChannel, refreshBadges])

  // Auto-scroll on new messages
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, activeChannel])

  const submit = useCallback(async (e) => {
    e?.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const msg = await sendMessage(activeChannel, text)
      setDraft('')
      if (msg?.flagged) toast('Your message contained abusive language — it was masked for everyone.', 'info')
      refreshBadges()
    } catch (err) {
      toast(err?.userMessage || 'Could not send. Please try again.', 'error')
    } finally {
      setSending(false)
    }
  }, [draft, sending, activeChannel, toast, refreshBadges])

  const removeMessage = useCallback(async (msg) => {
    const yes = await confirm({ title: 'Delete message?', message: 'This cannot be undone.', confirmText: 'Delete', tone: 'danger' })
    if (!yes) return
    try {
      await deleteMessage(msg)
      toast('Message deleted.', 'success')
    } catch (err) {
      toast(err?.userMessage || 'Could not delete that message.', 'error')
    }
  }, [confirm, toast])

  const inviteToGame = useCallback(async () => {
    if (!activeFriend) return
    const game = MULTIPLAYER_GAMES.find((g) => g.id === inviteGame)
    if (!game) return
    try {
      // Create the room NOW so the invite deep-link lands both players in a live room.
      // The inviter is then whisked into the game lobby to wait for their friend.
      let roomCode = null
      if (isSocketConfigured) {
        const sock = getSocket(profile)
        const res = await emitAck(sock, 'room:create', { game: game.id })
        if (res?.ok && res.code) roomCode = res.code
      }
      if (!roomCode) {
        // No multiplayer server reachable — send the invite without a room code;
        // friends can still hop into the game and create a room from its lobby.
        await sendGameInvite({ targetUid: activeFriend.uid, gameId: game.id, gameName: game.name, roomCode: null })
        toast(`Invite to ${game.name} sent to @${activeFriend.username} (no server — they'll create the room).`, 'info')
        return
      }
      await sendGameInvite({ targetUid: activeFriend.uid, gameId: game.id, gameName: game.name, roomCode })
      const sock = getSocket(profile)
      sock?.emit('invite', { toUsername: activeFriend.username, game: game.id, code: roomCode })
      toast(`Room ${roomCode} created — opening the lobby…`, 'success')
      sfx.coin()
      navigate(`/game/${game.id}?room=${roomCode}`)
    } catch (err) {
      toast(err?.userMessage || 'Could not send the invite.', 'error')
    }
  }, [activeFriend, inviteGame, profile, toast, navigate])

  const channelTitle = activeChannel === GLOBAL_CHANNEL ? 'Global Arcade Chat' : `@${activeFriend?.username || '…'}`
  const channelSub = activeChannel === GLOBAL_CHANNEL
    ? 'Everyone in the arcade hears you'
    : activeFriend?.online ? 'Online now' : 'Last seen recently'

  return (
    <div className="page container">
      <SEO title="Chat" description="Hang out in the Arcade Hub global chat or message friends directly — abuse filtered, seen ticks included." path="chat" />
      <div className="page-head">
        <div>
          <span className="eyebrow">Community</span>
          <h1 className="page-title">Chat &amp; <span className="hl">Rivals</span></h1>
          <p className="page-sub">Global banter and private trash talk. Messages vanish after 14 days; abuse is masked automatically.</p>
        </div>
        <span className="chip chip-multiplayer"><ShieldCheck size={13} /> Filtered &amp; moderated</span>
      </div>

      <div className="chat-layout">
        {/* ── Sidebar: channels ── */}
        <aside className="chat-sidebar" aria-label="Conversations">
          <div className="chat-sidebar-head">
            <strong>Conversations</strong>
          </div>
          <div className="chat-channels">
            <button className={`channel-item ${activeChannel === GLOBAL_CHANNEL ? 'active' : ''}`} onClick={() => setActiveChannel(GLOBAL_CHANNEL)}>
              <span className="channel-globe"><Globe2 size={19} /></span>
              <span className="channel-txt">
                <span className="channel-name">Global Arcade</span>
                <span className="channel-preview">Open to every player</span>
              </span>
            </button>
            <div className="channel-divider">Direct messages</div>
            {friendsLoading && <div className="page-loading" style={{ minHeight: 80 }}><Loader2 size={20} className="spin" /></div>}
            {!friendsLoading && friends.length === 0 && (
              <div className="channel-empty">
                <Users size={22} />
                <p>No friends yet. Add rivals to unlock private chats.</p>
                <Link to="/friends" className="btn btn-secondary btn-sm">Find friends</Link>
              </div>
            )}
            {friends.map((f) => {
              const ch = dmChannelId(profile.uid, f.uid)
              return (
                <button key={f.uid} className={`channel-item ${activeChannel === ch ? 'active' : ''}`} onClick={() => setActiveChannel(ch)}>
                  <Avatar name={f.username} color={f.avatarColor} size={34} />
                  <span className="channel-txt">
                    <span className="channel-name"><span className={`presence-dot ${f.online ? 'online' : ''}`} /> @{f.username}</span>
                    <span className="channel-preview">{f.online ? 'Online now' : 'Offline'}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        {/* ── Main thread ── */}
        <section className="chat-main" aria-label={`Chat with ${channelTitle}`}>
          <header className="chat-header">
            <MessagesSquare size={20} className="chat-header-icon" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3>{channelTitle}</h3>
              <span>{channelSub}</span>
            </div>
            {activeFriend && (
              <div className="invite-cluster">
                <select className="field-input invite-select" value={inviteGame} onChange={(e) => setInviteGame(e.target.value)} aria-label="Choose a game to invite to">
                  {MULTIPLAYER_GAMES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button className="invite-fab" onClick={inviteToGame}><Swords size={14} /> Invite to play</button>
              </div>
            )}
          </header>

          <div className="chat-messages" ref={listRef} aria-live="polite">
            {loadingMessages && <div className="page-loading" style={{ minHeight: 120 }}><Loader2 size={22} className="spin" /></div>}
            {!loadingMessages && messages.length === 0 && (
              <div className="chat-empty">
                <MessagesSquare size={40} strokeWidth={1.4} />
                <p><strong>Silence… for now.</strong><br />{activeChannel === GLOBAL_CHANNEL ? 'Be the first to say hello to the arcade.' : `Say hi to @${activeFriend?.username} — first message sets the tone.`}</p>
              </div>
            )}
            {messages.map((msg) => {
              const own = msg.from === profile.uid
              const seen = own && msg.readBy?.length > 1
              return (
                <div key={msg.id} className={`msg-row ${own ? 'own' : ''}`}>
                  {!own && <Avatar name={msg.fromName} color={msg.avatarColor} size={32} />}
                  <div className="msg-col">
                    <div className="msg-bubble">
                      {!own && <span className="msg-author">@{msg.fromName}{msg.flagged ? ' · filtered' : ''}</span>}
                      {msg.text}
                      {msg.flagged && <div className="msg-flag">Masked by the abuse filter</div>}
                    </div>
                    <div className="msg-meta">
                      <span>{dayLabel(msg.ts)}</span>
                      {own && <span className={`seen-tick ${seen ? 'seen' : ''}`} title={seen ? 'Seen' : 'Delivered'}>{seen ? <CheckCheck size={14} /> : <Check size={14} />}</span>}
                      {(own || isOperator) && (
                        <button className="msg-delete" onClick={() => removeMessage(msg)} aria-label="Delete message" title="Delete message"><Trash2 size={13} /></button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <form className="chat-input-row" onSubmit={submit}>
            <input
              className="field-input"
              placeholder={profile.muted ? 'You are muted by a moderator' : `Message ${activeChannel === GLOBAL_CHANNEL ? 'the arcade' : '@' + (activeFriend?.username || '')}…`}
              value={draft}
              maxLength={500}
              disabled={profile.muted || sending}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Type a message"
            />
            <button type="submit" className="btn btn-primary" disabled={sending || !draft.trim() || profile.muted} aria-label="Send message">
              <Send size={18} />
            </button>
          </form>
          <p className="chat-note"><Clock3 size={11} /> Messages auto-delete after 14 days · 500 char limit · be kind — the filter is watching.</p>
        </section>
      </div>
    </div>
  )
}
