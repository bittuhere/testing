// Rock Paper Scissors — online rooms (simultaneous throw, server-authoritative) + hotseat local duel
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { getSocket, emitAck, isSocketConfigured } from '../services/socket.js'
import { listFriends, sendGameInvite } from '../services/db.js'
import { RockIcon, PaperIcon, ScissorsIcon, RpsChoice, rpsWinner } from '../components/RpsIcons.jsx'
import { sfx } from '../services/sfx.js'
import { Wifi, WifiOff, Users, Bot, Copy, Check, Send, DoorOpen, RefreshCcw, Hand, Swords, Crown } from 'lucide-react'

export default function RPSOnline() {
  const { profile } = useAuth()
  const { toast, confirm } = useUI()
  const [searchParams] = useSearchParams()
  const deepRoom = (searchParams.get('room') || '').toUpperCase()

  const [screen, setScreen] = useState('menu') // menu | online | local | menu-bot
  const [room, setRoom] = useState(null)
  const [roomError, setRoomError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [friends, setFriends] = useState([])
  const [inviteTarget, setInviteTarget] = useState('')
  const socketRef = useRef(null)

  // ── Local hotseat state ──
  const [localPhase, setLocalPhase] = useState('p1') // p1 | p2 | reveal | done
  const [choice1, setChoice1] = useState(null)
  const [choice2, setChoice2] = useState(null)
  const [hotseatScore, setHotseatScore] = useState({ p1: 0, p2: 0 })
  const [seriesResult, setSeriesResult] = useState(null)

  const resetHotseat = (keepScore = false) => {
    setChoice1(null); setChoice2(null); setSeriesResult(null); setLocalPhase('p1')
    if (!keepScore) setHotseatScore({ p1: 0, p2: 0 })
  }

  const hotseatPick = (choice) => {
    if (localPhase === 'p1') { setChoice1(choice); setLocalPhase('p2'); sfx.select() }
    else if (localPhase === 'p2') {
      setChoice2(choice); setLocalPhase('reveal'); sfx.select()
      const verdict = rpsWinner(choice1, choice)
      setTimeout(() => {
        if (verdict === 'p1') { setHotseatScore((s) => ({ ...s, p1: s.p1 + 1 })); sfx.win() }
        else if (verdict === 'p2') { setHotseatScore((s) => ({ ...s, p2: s.p2 + 1 })); sfx.lose() }
        else sfx.point()
      }, 650)
    }
  }

  useEffect(() => {
    if (localPhase === 'reveal' && choice1 && choice2) {
      const t = setTimeout(() => {
        const w = rpsWinner(choice1, choice2)
        const nextP1 = hotseatScore.p1 + (w === 'p1' ? 1 : 0)
        const nextP2 = hotseatScore.p2 + (w === 'p2' ? 1 : 0)
        if (nextP1 >= 3) { setSeriesResult('p1'); setLocalPhase('done') }
        else if (nextP2 >= 3) { setSeriesResult('p2'); setLocalPhase('done') }
        else { setChoice1(null); setChoice2(null); setLocalPhase('p1') }
      }, 1500)
      return () => clearTimeout(t)
    }
  }, [localPhase, choice1, choice2, hotseatScore])

  // ── Online flow ──
  const attachSocket = useCallback(() => {
    if (!profile) { toast('Sign in to play online.', 'info'); return null }
    if (!isSocketConfigured) return null
    const sock = getSocket({ uid: profile.uid, username: profile.username })
    socketRef.current = sock
    sock.on('room:state', (state) => setRoom(state))
    sock.on('room:event', (evt) => {
      if (evt.type === 'notice') toast(evt.message || 'Connected.', 'info')
    })
    sock.on('invite', ({ from, code }) => {
      confirm({ title: `${from} invited you!`, message: 'Join their Rock Paper Scissors room right now?', confirmText: 'Join now' })
        .then((yes) => { if (yes) window.location.hash = `#/game/rpsonline?room=${code}` })
    })
    return sock
  }, [profile, toast, confirm])

  const createRoom = useCallback(async () => {
    setBusy(true); setRoomError('')
    const sock = attachSocket()
    if (!sock) { setBusy(false); setRoomError('socket-missing'); return }
    try {
      const res = await emitAck(sock, 'room:create', { game: 'rpsonline' })
      if (res?.error) throw new Error(res.error)
      setRoom(res.state || null)
      setScreen('online'); sfx.select()
    } catch (e) { setRoomError(e.userMessage || e.message || 'Could not create the room.') } finally { setBusy(false) }
  }, [attachSocket])

  const joinRoom = useCallback(async (code) => {
    if (!code) return
    setBusy(true); setRoomError('')
    const sock = attachSocket()
    if (!sock) { setBusy(false); setRoomError('socket-missing'); return }
    try {
      const res = await emitAck(sock, 'room:join', { game: 'rpsonline', code: code.trim().toUpperCase() })
      if (res?.error) throw new Error(res.error)
      setRoom(res.state || null)
      setScreen('online'); sfx.select()
    } catch (e) { setRoomError(e.userMessage || e.message || 'Could not join that room.') } finally { setBusy(false) }
  }, [attachSocket])

  useEffect(() => {
    if (deepRoom && profile && isSocketConfigured) joinRoom(deepRoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepRoom, profile])

  useEffect(() => { listFriends().then(setFriends).catch(() => {}) }, [])

  const [joinCode, setJoinCode] = useState(deepRoom)

  const leaveRoom = useCallback(async () => {
    const yes = await confirm({ title: 'Leave the room?', message: 'The room closes for both players.', confirmText: 'Leave', tone: 'danger' })
    if (!yes) return
    try { socketRef.current?.emit('room:leave', { code: room?.code }) } catch { /* ignore */ }
    setRoom(null); setScreen('menu')
  }, [confirm, room?.code])

  const copyCode = useCallback(async () => {
    try { await navigator.clipboard.writeText(room?.code || ''); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { toast('Room code: ' + room?.code, 'info') }
  }, [room?.code, toast])

  const inviteFriend = useCallback(async () => {
    if (!inviteTarget || !room?.code) return
    const friend = friends.find((f) => f.uid === inviteTarget)
    try {
      socketRef.current?.emit('invite', { toUsername: friend?.username, game: 'rpsonline', code: room.code })
      await sendGameInvite({ targetUid: inviteTarget, gameId: 'rpsonline', gameName: 'Rock Paper Scissors Online', roomCode: room.code })
      toast(`Invite sent to @${friend?.username}`, 'success')
      setInviteTarget('')
    } catch (e) { toast(e?.userMessage || 'Could not send the invite.', 'error') }
  }, [inviteTarget, room?.code, friends, toast])

  const mySlot = room?.players?.find((p) => p.uid === profile?.uid)?.slot // 'X' | 'O'
  const myChoiceMade = room?.choicesMade?.[mySlot]
  const pick = useCallback((choice) => {
    if (!room || myChoiceMade || room.matchWinner) return
    socketRef.current?.emit('rps:pick', { code: room.code, choice })
    sfx.select()
  }, [room, myChoiceMade])

  const rematch = useCallback(() => socketRef.current?.emit('room:rematch', { code: room?.code }), [room?.code])

  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'menu') {
    return (
      <div className="online-menu">
        <div className="online-card online-card-primary">
          <div className="online-card-icon rps"><Wifi size={26} /></div>
          <h3>Play online</h3>
          <p>Best of five against someone real. Both throws land at the same time — no peeking.</p>
          {isSocketConfigured ? (
            <>
              <button className="btn btn-primary btn-block" onClick={createRoom} disabled={busy}>{busy ? 'Working…' : 'Create room'}</button>
              <div className="join-row">
                <input className="field-input join-input" placeholder="ROOM CODE" value={joinCode} maxLength={8} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && joinRoom(joinCode)} aria-label="Room code" />
                <button className="btn btn-secondary" onClick={() => joinRoom(joinCode)} disabled={busy || !joinCode.trim()}>Join</button>
              </div>
              {roomError && roomError !== 'socket-missing' && <p className="field-error-text">{roomError}</p>}
            </>
          ) : (
            <p className="socket-missing-note"><WifiOff size={15} /> Online mode needs the multiplayer server (see README — deploy the <code>server/</code> folder on Render). Hotseat duel works right now.</p>
          )}
        </div>

        <div className="online-card">
          <div className="online-card-icon local"><Users size={26} /></div>
          <h3>Hotseat duel</h3>
          <p>Two players, one phone/PC — take turns throwing in secret. First to 3 rounds.</p>
          <button className="btn btn-secondary btn-block" onClick={() => { resetHotseat(false); setScreen('local') }}>Start hotseat</button>
        </div>
        <div className="online-card">
          <div className="online-card-icon bot"><Bot size={26} /></div>
          <h3>Solo vs. machine</h3>
          <p>Warm up against the classic CPU opponent in the single player cabinet.</p>
          <a className="btn btn-ghost btn-block" href="#/game/rps">Open Solo RPS</a>
        </div>
      </div>
    )
  }

  if (screen === 'local') {
    const reveal = localPhase === 'reveal' || localPhase === 'done'
    return (
      <div className="rps-arena hotseat">
        <div className="ttt-status-row">
          <span className="hud-chip">Hotseat — alternate throws, first to 3</span>
          <span className="hud-chip">P1 {hotseatScore.p1} · P2 {hotseatScore.p2} · first to 3</span>
          <button className="tiny-btn" onClick={() => setScreen('menu')}><DoorOpen size={13} /> Menu</button>
        </div>
        <p className="ttt-turn-line">
          {localPhase === 'p1' && 'Player 1 — throw in secret…'}
          {localPhase === 'p2' && 'Player 2 — your throw, no peeking…'}
          {reveal && choice1 === choice2 && 'Dead heat!'}
          {reveal && choice1 !== choice2 && `${rpsWinner(choice1, choice2) === 'p1' ? 'Player 1' : 'Player 2'} takes the round!`}
          {localPhase === 'done' && (seriesResult === 'p1' ? 'Player 1 wins the match!' : 'Player 2 wins the match!')}
        </p>
        <div className="rps-vs">
          <div className={`rps-pick ${reveal && rpsWinner(choice1, choice2) === 'p1' ? 'win' : ''}`}>
            {reveal && choice1 ? <RpsChoice choice={choice1} size={80} /> : <Hand size={52} strokeWidth={1.4} className="rps-placeholder" />}
            <span className="rps-pick-label">P1</span>
          </div>
          <div className="rps-vs-badge">VS</div>
          <div className={`rps-pick ${reveal && rpsWinner(choice1, choice2) === 'p2' ? 'win' : ''}`}>
            {reveal && choice2 ? <RpsChoice choice={choice2} size={80} /> : <Hand size={52} strokeWidth={1.4} className="rps-placeholder" />}
            <span className="rps-pick-label">P2</span>
          </div>
        </div>
        {localPhase !== 'done' ? (
          <div className="rps-choices">
            <button className="rps-choice-btn" onClick={() => hotseatPick('rock')}><RockIcon size={56} /><span>Rock</span></button>
            <button className="rps-choice-btn" onClick={() => hotseatPick('paper')}><PaperIcon size={56} /><span>Paper</span></button>
            <button className="rps-choice-btn" onClick={() => hotseatPick('scissors')}><ScissorsIcon size={56} /><span>Scissors</span></button>
          </div>
        ) : (
          <button className="btn btn-primary btn-lg" onClick={() => resetHotseat(false)}><RefreshCcw size={18} /> New match</button>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ONLINE ROOM
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="rps-arena hotseat">
      <div className="ttt-status-row">
        <span className="hud-chip">Room <b className="room-code">{room?.code || '…'}</b></span>
        <button className="tiny-btn" onClick={copyCode}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied!' : 'Copy code'}</button>
        <button className="tiny-btn danger" onClick={leaveRoom}><DoorOpen size={13} /> Leave</button>
      </div>

      {room && !room.started && (
        <div className="lobby-box">
          <p className="lobby-waiting"><span className="lobby-pulse" /> Waiting for an opponent…</p>
          <div className="join-row">
            <select className="field-input" value={inviteTarget} onChange={(e) => setInviteTarget(e.target.value)} aria-label="Pick a friend">
              <option value="">Select a friend…</option>
              {friends.map((f) => <option key={f.uid} value={f.uid}>@{f.username}</option>)}
            </select>
            <button className="btn btn-secondary" onClick={inviteFriend} disabled={!inviteTarget}><Send size={15} /> Invite</button>
          </div>
        </div>
      )}

      {room && (
        <>
          <div className="ttt-players-row">
            {room.players.map((p) => (
              <div key={p.uid} className="ttt-player-chip">
                <Swords size={16} />
                <span className="ttt-player-name">@{p.username}{p.uid === profile?.uid ? ' (you)' : ''}</span>
                {room.matchWinner && room.matchWinner === p.slot && <Crown size={14} className="crown" />}
              </div>
            ))}
            {room.players.length < 2 && <div className="ttt-player-chip waiting"><Hand size={17} /><span className="ttt-player-name">Waiting…</span></div>}
          </div>

          <div className="score-pill"><span>YOU {mySlot ? room.wins?.[mySlot] ?? 0 : 0}</span><Swords size={15} /><span>THEM {mySlot ? room.wins?.[mySlot === 'X' ? 'O' : 'X'] ?? 0 : 0}</span></div>
          <p className="ttt-turn-line">
            {!room.started && 'The match begins when your opponent arrives.'}
            {room.started && !room.reveal && !room.matchWinner && (myChoiceMade ? 'Throw locked in — waiting for them…' : 'Choose your throw…')}
            {room.reveal && (room.reveal.roundWinner === 'tie' ? 'Dead heat — same throw!' : (room.reveal.roundWinner === mySlot ? 'You take the round!' : 'They take the round.'))}
            {room.matchWinner && (room.matchWinner === mySlot ? 'Match yours — GG!' : 'Match theirs. Rematch?')}
          </p>

          <div className="rps-vs">
            <div className={`rps-pick ${room.reveal?.roundWinner === mySlot ? 'win' : room.reveal && room.reveal.roundWinner !== 'tie' ? 'lose' : ''}`}>
              {room.reveal ? <RpsChoice choice={room.reveal[mySlot === 'X' ? 'x' : 'o']} size={76} /> : <Hand size={50} strokeWidth={1.4} className="rps-placeholder" />}
              <span className="rps-pick-label">YOU</span>
            </div>
            <div className="rps-vs-badge">R{room.round}</div>
            <div className={`rps-pick ${room.reveal && room.reveal.roundWinner !== 'tie' && room.reveal.roundWinner !== mySlot ? 'win' : room.reveal?.roundWinner === mySlot ? 'lose' : ''}`}>
              {room.reveal ? <RpsChoice choice={room.reveal[mySlot === 'X' ? 'o' : 'x']} size={76} /> : <Hand size={50} strokeWidth={1.4} className="rps-placeholder" />}
              <span className="rps-pick-label">THEM</span>
            </div>
          </div>

          {!room.matchWinner ? (
            <div className="rps-choices">
              <button className="rps-choice-btn" onClick={() => pick('rock')} disabled={myChoiceMade || !room.started}><RockIcon size={54} /><span>Rock</span></button>
              <button className="rps-choice-btn" onClick={() => pick('paper')} disabled={myChoiceMade || !room.started}><PaperIcon size={54} /><span>Paper</span></button>
              <button className="rps-choice-btn" onClick={() => pick('scissors')} disabled={myChoiceMade || !room.started}><ScissorsIcon size={54} /><span>Scissors</span></button>
            </div>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={rematch}><RefreshCcw size={18} /> Rematch (both must vote)</button>
          )}
        </>
      )}
    </div>
  )
}

