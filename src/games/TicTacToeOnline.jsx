// Tic-Tac-Toe — three ways to play: online room (server-authoritative), vs Bot, pass & play
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { getSocket, emitAck, isSocketConfigured } from '../services/socket.js'
import { listFriends, sendGameInvite } from '../services/db.js'
import { sfx } from '../services/sfx.js'
import { Users, Bot, Copy, Check, UserRound, Wifi, WifiOff, Send, RefreshCcw, DoorOpen, Crown } from 'lucide-react'

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
const winnerOf = (board) => {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], line: [a, b, c] }
  }
  return board.every(Boolean) ? { winner: 'draw', line: [] } : null
}
const minimax = (board, isBot, botMark, humanMark, depth = 0) => {
  const result = winnerOf(board)
  if (result) {
    if (result.winner === botMark) return { score: 10 - depth }
    if (result.winner === humanMark) return { score: depth - 10 }
    return { score: 0 }
  }
  let best = isBot ? { score: -Infinity } : { score: Infinity }
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue
    board[i] = isBot ? botMark : humanMark
    const { score } = minimax(board, !isBot, botMark, humanMark, depth + 1)
    board[i] = null
    if (isBot ? score > best.score : score < best.score) best = { score, index: i }
  }
  return best
}

function Mark({ value, size = 44 }) {
  if (value === 'X') return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-label="X">
      <line x1="10" y1="10" x2="38" y2="38" stroke="#3BD6FF" strokeWidth="6" strokeLinecap="round" />
      <line x1="38" y1="10" x2="10" y2="38" stroke="#3BD6FF" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
  if (value === 'O') return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-label="O">
      <circle cx="24" cy="24" r="15" fill="none" stroke="#FF4D8D" strokeWidth="6" />
    </svg>
  )
  return null
}

export default function TicTacToeOnline() {
  const { profile } = useAuth()
  const { toast, confirm } = useUI()
  const [screen, setScreen] = useState('menu') // menu | online | bot | local
  const [room, setRoom] = useState(null)
  const [roomError, setRoomError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [friends, setFriends] = useState([])
  const [inviteTarget, setInviteTarget] = useState('')
  const [roomChat, setRoomChat] = useState([])
  const [chatDraft, setChatDraft] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const socketRef = useRef(null)
  const chatEndRef = useRef(null)

  // ── Local implementations (bot & pass and play) ──
  const [localBoard, setLocalBoard] = useState(Array(9).fill(null))
  const [localTurn, setLocalTurn] = useState('X')
  const [localWinner, setLocalWinner] = useState(null) // {winner, line}
  const [localScores, setLocalScores] = useState({ X: 0, O: 0, draws: 0 })

  const resetLocal = useCallback(() => {
    setLocalBoard(Array(9).fill(null)); setLocalTurn('X'); setLocalWinner(null)
  }, [])

  const handleLocalMove = useCallback((index, byBot = false) => {
    if (localWinner || localBoard[index]) return
    if (screen === 'bot' && localTurn === 'O' && !byBot) return // human can't move for the bot
    if (screen === 'bot' && localTurn === 'X' && byBot) return
    const next = [...localBoard]
    next[index] = localTurn
    setLocalBoard(next)
    sfx.click()
    const result = winnerOf(next)
    if (result) {
      setLocalWinner(result)
      setLocalScores((s) => result.winner === 'draw' ? { ...s, draws: s.draws + 1 } : { ...s, [result.winner]: s[result.winner] + 1 })
      result.winner === 'draw' ? sfx.point() : (screen === 'bot' ? (result.winner === 'X' ? sfx.win() : sfx.lose()) : sfx.win())
      return
    }
    setLocalTurn(localTurn === 'X' ? 'O' : 'X')
  }, [localBoard, localTurn, localWinner, screen])

  // Bot takes O turns
  useEffect(() => {
    if (screen !== 'bot' || localTurn !== 'O' || localWinner) return
    const t = setTimeout(() => {
      const board = [...localBoard]
      const best = minimax(board, true, 'O', 'X')
      if (best.index !== undefined) handleLocalMove(best.index, true)
    }, 420)
    return () => clearTimeout(t)
  }, [screen, localTurn, localWinner, localBoard, handleLocalMove])

  // ── Online flow ──
  const [searchParams] = useSearchParams()
  const deepRoom = (searchParams.get('room') || '').toUpperCase()

  const attachSocket = useCallback(() => {
    if (!profile) { toast('Sign in to play online.', 'info'); return null }
    if (!isSocketConfigured) return null
    const sock = getSocket({ uid: profile.uid, username: profile.username })
    socketRef.current = sock
    sock.on('room:state', (state) => setRoom(state))
    sock.on('room:event', (evt) => {
      if (evt.type === 'chat') {
        setRoomChat((prev) => [...prev.slice(-29), evt])
        sfx.notify()
      } else if (evt.type === 'notice') {
        toast(evt.message || 'Connected.', 'info')
      }
    })
    sock.on('invite', ({ from, code }) => {
      confirm({ title: `${from} invited you!`, message: 'Jump straight into their Tic-Tac-Toe room?', confirmText: 'Join now' })
        .then((yes) => { if (yes) window.location.hash = `#/game/tictactoe?room=${code}` })
    })
    return sock
  }, [profile, toast, confirm])

  const createRoom = useCallback(async () => {
    setBusy(true); setRoomError('')
    const sock = attachSocket()
    if (!sock) { setBusy(false); setRoomError('socket-missing'); return }
    try {
      const res = await emitAck(sock, 'room:create', { game: 'tictactoe' })
      if (res?.error) throw new Error(res.error)
      setScreen('online')
      sfx.select()
    } catch (e) {
      setRoomError(e.userMessage || e.message || 'Could not create the room.')
    } finally { setBusy(false) }
  }, [attachSocket])

  const joinRoom = useCallback(async (code) => {
    if (!code) return
    setBusy(true); setRoomError('')
    const sock = attachSocket()
    if (!sock) { setBusy(false); setRoomError('socket-missing'); return }
    try {
      const res = await emitAck(sock, 'room:join', { game: 'tictactoe', code: code.trim().toUpperCase() })
      if (res?.error) throw new Error(res.error)
      setScreen('online')
      sfx.select()
    } catch (e) {
      setRoomError(e.userMessage || e.message || 'Could not join that room. Check the code.')
    } finally { setBusy(false) }
  }, [attachSocket])

  // Deep link ?room=CODE — auto join once profile is ready
  useEffect(() => {
    if (deepRoom && profile && isSocketConfigured) joinRoom(deepRoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepRoom, profile])

  useEffect(() => { listFriends().then(setFriends).catch(() => {}) }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [roomChat.length])

  const leaveRoom = useCallback(async () => {
    const yes = await confirm({ title: 'Leave the room?', message: 'Your opponent will be notified. The room will close for both of you.', confirmText: 'Leave', tone: 'danger' })
    if (!yes) return
    try { socketRef.current?.emit('room:leave', { code: room?.code }) } catch { /* ignore */ }
    setRoom(null); setRoomChat([]); setScreen('menu')
  }, [confirm, room?.code])

  const copyCode = useCallback(async () => {
    try { await navigator.clipboard.writeText(room?.code || ''); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { toast('Could not copy — note it down: ' + room?.code, 'info') }
  }, [room?.code, toast])

  const inviteFriend = useCallback(async () => {
    if (!inviteTarget || !room?.code) return
    const friend = friends.find((f) => f.uid === inviteTarget)
    try {
      socketRef.current?.emit('invite', { toUsername: friend?.username, game: 'tictactoe', code: room.code })
      await sendGameInvite({ targetUid: inviteTarget, gameId: 'tictactoe', gameName: 'Tic-Tac-Toe', roomCode: room.code })
      toast(`Invite sent to @${friend?.username}`, 'success')
      setInviteTarget('')
    } catch (e) { toast(e?.userMessage || 'Could not send the invite.', 'error') }
  }, [inviteTarget, room?.code, friends, toast])

  const sendRoomChat = useCallback(() => {
    const text = chatDraft.trim()
    if (!text) return
    socketRef.current?.emit('room:chat', { code: room?.code, text })
    setChatDraft('')
  }, [chatDraft, room?.code])

  const mySlot = room?.players?.find((p) => p.uid === profile?.uid)?.slot
  const isMyTurn = room && room.started && !room.winner && room.turn === mySlot

  const onlineMove = useCallback((index) => {
    if (!room || !isMyTurn || room.board[index]) return
    socketRef.current?.emit('ttt:move', { code: room.code, index })
    sfx.click()
  }, [room, isMyTurn])

  const rematch = useCallback(() => { socketRef.current?.emit('room:rematch', { code: room?.code }) }, [room?.code])

  // ───────────────────────────────────────────────────────────────────────────
  // MENU
  // ───────────────────────────────────────────────────────────────────────────
  if (screen === 'menu') {
    return (
      <div className="online-menu">
        {/* Online card */}
        <div className="online-card online-card-primary">
          <div className="online-card-icon"><Wifi size={26} /></div>
          <h3>Play online</h3>
          <p>Create a private room, share the code — or paste a friend&apos;s code to join instantly.</p>
          {isSocketConfigured ? (
            <>
              <button className="btn btn-primary btn-block" onClick={createRoom} disabled={busy}>{busy ? 'Working…' : 'Create room'}</button>
              <div className="join-row">
                <input
                  className="field-input join-input"
                  placeholder="ROOM CODE"
                  value={joinCode}
                  maxLength={8}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && joinRoom(joinCode)}
                  aria-label="Room code"
                />
                <button className="btn btn-secondary" onClick={() => joinRoom(joinCode)} disabled={busy || !joinCode.trim()}>Join</button>
              </div>
              {roomError && roomError !== 'socket-missing' && <p className="field-error-text">{roomError}</p>}
            </>
          ) : (
            <p className="socket-missing-note"><WifiOff size={15} /> Online mode needs the Arcade Hub multiplayer server (deploy <code>server/</code> on Render — see README). Bot and Pass &amp; Play modes work everywhere.</p>
          )}
        </div>

        {/* Local modes */}
        <div className="online-card">
          <div className="online-card-icon bot"><Bot size={26} /></div>
          <h3>Vs. the Bot</h3>
          <p>Face a flawless minimax AI. It never blinks — can you?</p>
          <button className="btn btn-secondary btn-block" onClick={() => { resetLocal(); setLocalScores({ X: 0, O: 0, draws: 0 }); setScreen('bot') }}>Challenge the bot</button>
        </div>
        <div className="online-card">
          <div className="online-card-icon local"><Users size={26} /></div>
          <h3>Pass &amp; play</h3>
          <p>Two players, one screen. Alternate turns on this device.</p>
          <button className="btn btn-ghost btn-block" onClick={() => { resetLocal(); setLocalScores({ X: 0, O: 0, draws: 0 }); setScreen('local') }}>Start local duel</button>
        </div>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LOCAL / BOT BOARD
  // ───────────────────────────────────────────────────────────────────────────
  if (screen === 'bot' || screen === 'local') {
    const title = screen === 'bot' ? 'You (X) vs Bot (O)' : 'Local duel — X starts'
    return (
      <div className="ttt-board-panel">
        <div className="ttt-status-row">
          <span className="hud-chip">{title}</span>
          <span className="hud-chip">X {localScores.X} · O {localScores.O} · Draws {localScores.draws}</span>
          <button className="tiny-btn" onClick={() => setScreen('menu')}><DoorOpen size={13} /> Menu</button>
        </div>
        <p className="ttt-turn-line">
          {localWinner
            ? localWinner.winner === 'draw' ? 'Cat\'s game — nobody blinks.' : `${localWinner.winner} takes the round!`
            : screen === 'bot' ? (localTurn === 'X' ? 'Your move.' : 'Bot is thinking…') : `${localTurn} to move`}
        </p>
        <div className="ttt-grid" role="grid" aria-label="Tic Tac Toe board">
          {localBoard.map((cell, i) => (
            <button key={i} className={`ttt-cell ${localWinner?.line?.includes(i) ? 'win' : ''}`} onClick={() => handleLocalMove(i)} aria-label={`Cell ${i + 1}${cell ? ` occupied by ${cell}` : ''}`}>
              <Mark value={cell} />
            </button>
          ))}
        </div>
        {localWinner && (
          <button className="btn btn-primary btn-block" onClick={resetLocal}><RefreshCcw size={17} /> Rematch</button>
        )}
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ONLINE ROOM
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div className="ttt-board-panel">
      <div className="ttt-status-row">
        <span className="hud-chip">Room <b className="room-code">{room?.code || '…'}</b></span>
        <button className="tiny-btn" onClick={copyCode}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied!' : 'Copy code'}</button>
        <button className="tiny-btn danger" onClick={leaveRoom}><DoorOpen size={13} /> Leave</button>
      </div>

      {/* Lobby: invite friends */}
      {room && !room.started && (
        <div className="lobby-box">
          <p className="lobby-waiting"><span className="lobby-pulse" /> Waiting for an opponent…</p>
          <p className="lobby-hint">Share the code above, or invite a friend directly:</p>
          <div className="join-row">
            <select className="field-input" value={inviteTarget} onChange={(e) => setInviteTarget(e.target.value)} aria-label="Pick a friend">
              <option value="">Select a friend…</option>
              {friends.map((f) => <option key={f.uid} value={f.uid}>@{f.username}</option>)}
            </select>
            <button className="btn btn-secondary" onClick={inviteFriend} disabled={!inviteTarget}><Send size={15} /> Invite</button>
          </div>
          {friends.length === 0 && <p className="field-hint">Add friends from the Friends page to invite them here in one tap.</p>}
        </div>
      )}

      {room && (
        <>
          <div className="ttt-players-row">
            {room.players.map((p) => (
              <div key={p.uid} className={`ttt-player-chip ${room.turn === p.slot && room.started && !room.winner ? 'turn' : ''}`}>
                <span className={`ttt-slot slot-${p.slot}`}>{p.slot}</span>
                <span className="ttt-player-name">@{p.username}{p.uid === profile?.uid ? ' (you)' : ''}</span>
                {room.winner && room.winner !== 'draw' && room.winner === p.slot && <Crown size={14} className="crown" />}
              </div>
            ))}
            {room.players.length < 2 && <div className="ttt-player-chip waiting"><UserRound size={17} /><span className="ttt-player-name">Waiting…</span></div>}
          </div>

          <p className="ttt-turn-line">
            {!room.started && 'The match begins when your opponent joins.'}
            {room.started && !room.winner && (isMyTurn ? 'Your move — place the mark.' : `Waiting for @${room.players.find((p) => p.slot === room.turn)?.username || 'opponent'}…`)}
            {room.winner === 'draw' && 'A perfect draw. Run it back?'}
            {room.winner && room.winner !== 'draw' && (mySlot === room.winner ? 'Victory is yours!' : 'Defeat… this time.')}
          </p>

          <div className="ttt-grid" role="grid" aria-label="Tic Tac Toe board">
            {room.board.map((cell, i) => (
              <button key={i} className={`ttt-cell ${room.line?.includes(i) ? 'win' : ''}`} onClick={() => onlineMove(i)} disabled={!isMyTurn || !!cell || !!room.winner} aria-label={`Cell ${i + 1}`}>
                <Mark value={cell} />
              </button>
            ))}
          </div>

          {room.winner && (
            <div className="rematch-row">
              <button className="btn btn-primary" onClick={rematch}><RefreshCcw size={17} /> Rematch</button>
              <span className="field-hint">Rematch starts when both players vote.</span>
            </div>
          )}

          {/* In-room chat */}
          <div className="room-chat">
            <div className="room-chat-log">
              {roomChat.length === 0 && <p className="field-hint">Room chat is private to this match and disappears when you leave.</p>}
              {roomChat.map((m, i) => (
                <p key={i} className="room-chat-msg"><b>@{m.from}</b> {m.text}</p>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="room-chat-input">
              <input className="field-input" placeholder="Say something in the room…" value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendRoomChat()} maxLength={300} aria-label="Room chat message" />
              <button className="icon-btn" onClick={sendRoomChat} aria-label="Send"><Send size={18} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
