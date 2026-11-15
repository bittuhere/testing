/**
 * Arcade Hub — multiplayer backend (Node.js + Socket.IO)
 * ======================================================
 * Deploy on Render (Free tier works):
 *   Root directory: server
 *   Build command:  npm install
 *   Start command:  npm start
 *   Health check path: /ping  (GET or HEAD — both return 200 with no body work)
 *   /ping   — liveness probe, unauthenticated, no Firestore/socket access
 *   /health — detailed probe (rooms, uptime), same purpose
 *
 * Security model
 * --------------
 * Set FIREBASE_SERVICE_ACCOUNT_JSON (the full service-account JSON as one env var)
 * and the server verifies Firebase ID tokens on every socket connection — usernames
 * cannot be forged. Without it, the server trusts the client-provided handshake
 * (uid + username); fine for local testing only.
 *
 * Push notifications (optional)
 * -----------------------------
 * With the same service account, invites to OFFLINE players are sent as FCM push
 * messages to tokens stored in Firestore at users/{uid}.fcmTokens.
 *
 * Wire protocol (JSON over Socket.IO)
 * -----------------------------------
 * client → server
 *   room:create { game }                      → ack { ok, code } | { ok:false, error }
 *   room:join   { game, code }                → ack { ok, state } | { ok:false, error }
 *   room:leave  { code }                      (no ack)
 *   room:chat   { code, text }                → room:event { type:'chat', ... }
 *   room:rematch{ code }                      → fresh state broadcast
 *   ttt:move    { code, index }               → room:state
 *   rps:pick    { code, choice }              → room:state (choicesMade, then reveal)
 *   invite      { toUsername, game, code }    → target socket 'invite' + FCM (optional)
 *
 * server → client
 *   room:state  (full state snapshot; see makeInitialState)
 *   room:event  { type:'chat'|'player-joined'|'player-left'|'notice'|'rematch'|'error', ... }
 *   invite      { from, game, code }
 */

'use strict'

const express = require('express')
const http = require('http')
const cors = require('cors')
const { Server } = require('socket.io')
const crypto = require('crypto')

const PORT = process.env.PORT || 3001
// Origins must be scheme://host[:port] — NEVER a path. If someone pastes
// "https://host/path" into the dashboard we silently strip the path (and warn),
// because an Origin header never carries one; otherwise every browser request
// fails CORS while the server looks "healthy".
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((entry) => {
    if (entry === '*') return entry
    try {
      const u = new URL(entry)
      if (u.pathname !== '/' && u.pathname !== '') {
        console.warn(`[Arcade Hub] ALLOWED_ORIGINS entry "${entry}" contains a path — using "${u.origin}" instead. Origins never include paths.`)
        return u.origin
      }
      return u.origin
    } catch {
      console.warn(`[Arcade Hub] ALLOWED_ORIGINS entry "${entry}" is not a valid URL — keeping it verbatim (likely matches nothing).`)
      return entry
    }
  })
// Accept either name — the Render setup used FIREBASE_SERVICE_ACCOUNT.
const SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT || ''

// Tolerate the three ways people paste a service-account key into a dashboard
// (raw JSON, single-line escaped JSON, base64-encoded JSON).
function parseServiceAccount(raw) {
  if (!raw) return null
  try { return JSON.parse(raw) } catch (_) {}
  try { return JSON.parse(raw.replace(/\\n/g, '\n')) } catch (_) {}
  try { return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) } catch (_) {}
  return null
}

// ── Optional Firebase Admin (token verification + FCM) ─────────────────────
let admin = null
try {
  if (SERVICE_ACCOUNT_JSON) {
    const serviceAccount = parseServiceAccount(SERVICE_ACCOUNT_JSON)
    if (!serviceAccount) throw new Error('could not parse service-account JSON (set it as one-line JSON, or base64)')
    admin = require('firebase-admin')
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
    console.log('[Arcade Hub] Firebase Admin initialised — ID tokens will be verified, FCM enabled.')
  } else {
    console.warn('[Arcade Hub] FIREBASE_SERVICE_ACCOUNT_JSON not set — DEV MODE: trusting client handshake.')
  }
} catch (err) {
  console.error('[Arcade Hub] Failed to initialise Firebase Admin:', err.message)
  console.warn('[Arcade Hub] Continuing in DEV MODE without token verification.')
  admin = null
}

// ── Abuse filter (mirrors the client-side filter) ──────────────────────────
const BANNED_WORDS = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'piss',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'whore', 'slut', 'rape',
]
function filterChat(raw) {
  let text = String(raw || '').slice(0, 500).trim()
  if (!text) return { text: '', flagged: false, hits: 0 }
  let flagged = false
  let hits = 0
  for (const word of BANNED_WORDS) {
    const re = new RegExp(word.split('').join('[\\s._-]*'), 'gi')
    text = text.replace(re, (m) => { flagged = true; hits += 1; return '*'.repeat(m.length) })
  }
  text = text.replace(/(.)\1{9,}/g, '$1$1$1$1$1$1$1$1') // collapse absurd repeats
  return { text, flagged, hits }
}

// ── Usernames ──────────────────────────────────────────────────────────────
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9]|_(?=[a-z0-9])){1,18}[a-z0-9]$|^[a-z0-9]{3,20}$/
function sanitizeUsername(raw) {
  const v = String(raw || '').trim().toLowerCase()
  if (v.length < 3 || v.length > 20) return null
  if (!/^[a-z0-9_]+$/.test(v)) return null
  if ((v.match(/_/g) || []).length > 1) return null
  if (v.startsWith('_') || v.endsWith('_')) return null
  return v
}
const sanitizeUid = (raw) => String(raw || '').trim().slice(0, 128) || crypto.randomBytes(8).toString('hex')

// ── Rooms ──────────────────────────────────────────────────────────────────
const rooms = new Map()          // code → room
const socketIndex = new Map()    // socket.id → { uid, username }
const uidToSocket = new Map()    // uid → Set<socket.id>
const ROOM_TTL_MS = 2 * 60 * 60 * 1000 // 2h idle → swept

const GAMES = new Set(['tictactoe', 'rpsonline'])
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no confusing chars

function makeCode() {
  for (;;) {
    const code = Array.from({ length: 6 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('')
    if (!rooms.has(code)) return code
  }
}

function freshState(room) {
  if (room.game === 'tictactoe') {
    return {
      code: room.code, game: room.game, started: room.players.length === 2,
      turn: 'X', board: Array(9).fill(null), line: null, winner: null,
      players: playersPayload(room),
    }
  }
  // rpsonline
  return {
    code: room.code, game: room.game, started: room.players.length === 2,
    round: 1, choicesMade: { X: false, O: false }, reveal: null,
    wins: { X: 0, O: 0 }, matchWinner: null,
    players: playersPayload(room),
  }
}

function playersPayload(room) {
  const seat = (i) => (room.players[i] ? { uid: room.players[i].uid, username: room.players[i].username } : null)
  return { X: seat(0), O: seat(1) }
}

function createRoom(game, host) {
  const code = makeCode()
  const room = {
    code, game, hostUid: host.uid,
    players: [host],           // index 0 = X, 1 = O
    state: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  room.state = freshState(room)
  rooms.set(code, room)
  return room
}

function touch(room) { room.updatedAt = Date.now() }

function roomForSocket(socket, code) {
  const room = rooms.get(String(code || '').toUpperCase().trim())
  if (!room) return null
  const seatIndex = room.players.findIndex((p) => p.socketId === socket.id)
  if (seatIndex === -1) return null
  return { room, seatIndex }
}

function broadcastState(io, room) {
  io.to(room.code).emit('room:state', room.state)
}

function emitToRoom(io, code, event, payload) {
  io.to(code).emit(event, payload)
}

// ── Tic-Tac-Toe logic ──────────────────────────────────────────────────────
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
function applyTttMove(room, seatIndex, index) {
  const s = room.state
  if (s.winner) return { ok: false, error: 'The match is over — rematch to play again.' }
  if (!s.started) return { ok: false, error: 'Waiting for an opponent to join.' }
  const seat = seatIndex === 0 ? 'X' : 'O'
  if (s.turn !== seat) return { ok: false, error: 'Not your turn.' }
  if (!Number.isInteger(index) || index < 0 || index > 8) return { ok: false, error: 'Invalid cell.' }
  if (s.board[index]) return { ok: false, error: 'That cell is taken.' }

  s.board[index] = seat
  for (const line of LINES) {
    const [a, b, c] = line
    if (s.board[a] && s.board[a] === s.board[b] && s.board[b] === s.board[c]) {
      s.winner = seat
      s.line = line
      break
    }
  }
  if (!s.winner && s.board.every(Boolean)) s.winner = 'draw'
  if (!s.winner) s.turn = seat === 'X' ? 'O' : 'X'
  return { ok: true }
}

// ── RPS logic ──────────────────────────────────────────────────────────────
const RPS_CHOICES = new Set(['rock', 'paper', 'scissors'])
const rpsPending = new Map() // code → { X: 'rock', O: null } (server-side only; never broadcast)

function rpsRoundWinner(x, o) {
  if (x === o) return 'draw'
  const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' }
  return beats[x] === o ? 'X' : 'O'
}

function applyRpsPick(room, seatIndex, choice) {
  const s = room.state
  if (s.matchWinner) return { ok: false, error: 'The match is over — rematch to play again.' }
  if (!s.started) return { ok: false, error: 'Waiting for an opponent to join.' }
  const seat = seatIndex === 0 ? 'X' : 'O'
  const c = String(choice || '').toLowerCase()
  if (!RPS_CHOICES.has(c)) return { ok: false, error: 'Pick rock, paper or scissors.' }

  const pending = rpsPending.get(room.code) || { X: null, O: null }
  if (pending[seat]) return { ok: false, error: 'You already locked in this round.' }
  pending[seat] = c
  rpsPending.set(room.code, pending)
  s.choicesMade[seat] = true

  if (pending.X && pending.O) {
    const roundWinner = rpsRoundWinner(pending.X, pending.O)
    if (roundWinner !== 'draw') s.wins[roundWinner] += 1
    s.reveal = { x: pending.X, o: pending.O, roundWinner }
    if (s.wins.X >= 2 || s.wins.O >= 2) {
      s.matchWinner = s.wins.X >= 2 ? 'X' : 'O'
    } else if (s.round >= 5) {
      s.matchWinner = s.wins.X === s.wins.O ? 'draw' : (s.wins.X > s.wins.O ? 'X' : 'O')
    }
    // Clear picks for the next round (keep result visible until next round starts)
    rpsPending.set(room.code, { X: null, O: null })
    s.round += 1
    s.choicesMade = { X: false, O: false }
  }
  return { ok: true }
}

// ── Online presence ────────────────────────────────────────────────────────
function announceJoin(io, room) {
  if (!room.state.started && room.players.length === 2) {
    room.state.started = true
    // Rebuild state with both seats filled; X always moves first / starts
    const fresh = freshState(room)
    room.state = { ...fresh, started: true }
  }
  emitToRoom(io, room.code, 'room:event', { type: 'player-joined', players: playersPayload(room) })
}

function removeSocketFromRoom(io, socket, room) {
  const before = room.players.length
  room.players = room.players.filter((p) => p.socketId !== socket.id)
  socket.leave(room.code)
  if (room.players.length === 0) {
    rooms.delete(room.code)
    rpsPending.delete(room.code)
    return
  }
  // Surviving player wins forfeit notice; reset to waiting state but keep seat
  const survivor = room.players[0]
  const fresh = freshState(room)
  fresh.started = false
  fresh.players = playersPayload({ ...room, players: [survivor] })
  room.state = fresh
  room.hostUid = survivor.uid
  touch(room)
  if (before > room.players.length) {
    emitToRoom(io, room.code, 'room:event', { type: 'player-left', username: 'opponent' })
    broadcastState(io, room)
  }
}

// ── HTTP + Socket.IO ───────────────────────────────────────────────────────
const app = express()
app.use(cors({ origin: ALLOWED_ORIGINS.includes('*') ? true : ALLOWED_ORIGINS }))
app.use(express.json({ limit: '16kb' }))

// ── Password gate (legacy SHA-1 → SHA-256 transparent migration) ───────────
const sha1Hex = (s) => crypto.createHash('sha1').update(String(s), 'utf8').digest('hex')
const sha256Hex = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex')
const vpBuckets = new Map() // ip → { count, resetAt } (brute-force throttle)

function vpAllow(ip) {
  const nowTs = Date.now()
  const b = vpBuckets.get(ip)
  if (!b || nowTs > b.resetAt) { vpBuckets.set(ip, { count: 1, resetAt: nowTs + 60_000 }); return true }
  if (b.count >= 20) return false
  b.count += 1
  return true
}

app.post('/verify-password', async (req, res) => {
  const identifier = String(req.body?.identifier || '').trim().toLowerCase().slice(0, 320)
  const password = String(req.body?.password || '')
  if (!vpAllow(req.ip || 'unknown')) return res.status(429).json({ ok: false, error: 'Too many attempts — wait a minute.' })
  if (!identifier || !password) return res.status(400).json({ ok: false, error: 'Missing credentials.' })
  if (!admin) {
    // Dev mode without a service account: no server-side hash check — Firebase decides.
    return res.json({ ok: true, email: identifier.includes('@') ? identifier : null })
  }
  try {
    const store = admin.firestore()
    let uid = null
    let email = identifier.includes('@') ? identifier : null
    if (identifier.includes('@')) {
      const snap = await store.collection('users').where('email', '==', identifier).limit(1).get()
      if (!snap.empty) uid = snap.docs[0].id
    } else {
      const uname = await store.doc('usernames/' + identifier).get()
      if (uname.exists) {
        uid = uname.data()?.uid || null
        if (uid) {
          const uDoc = await store.doc('users/' + uid).get()
          email = uDoc.exists ? (uDoc.data()?.email || null) : null
        }
      }
    }
    if (!uid) return res.json({ ok: true, email: null }) // unknown account — let Firebase produce the error

    const secretRef = store.doc('secrets/' + uid)
    const secretSnap = await secretRef.get()
    if (!secretSnap.exists) return res.json({ ok: true, email }) // Firebase is the only gate
    const appHash = String(secretSnap.data()?.appHash || '')
    const sha256 = sha256Hex(password)
    if (appHash === sha256) return res.json({ ok: true, email })
    if (appHash === sha1Hex(password)) {
      await secretRef.set({ appHash: sha256, migratedFrom: 'sha1' }, { merge: true })
      console.log(`[verify-password] migrated SHA-1 → SHA-256 for uid ${uid}`)
      return res.json({ ok: true, email, migrated: true })
    }
    return res.json({ ok: false, error: 'Incorrect password. Please try again.' })
  } catch (err) {
    console.error('[verify-password] failed:', err)
    return res.json({ ok: true, email: null }) // never hard-block logins on our own error
  }
})

// ── Render health probes ───────────────────────────────────────────────────
// /ping: ultra-cheap liveness check — works for HEAD too (Render accepts both),
// never touches Firestore/socket state, and returns immediately.
const pingHandler = (_req, res) => {
  res.status(200).json({ ok: true, service: 'arcade-hub-server', ts: Date.now() })
}
app.get('/ping', pingHandler)
app.head('/ping', pingHandler) // explicit HEAD support (Render allows HEAD probes)
app.all('/ping', (_req, res) => res.status(405).json({ ok: false, error: 'Method not allowed' })) // anything else

app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size, uptime: process.uptime() }))
app.head('/health', (_req, res) => res.status(200).end())
app.get('/', (_req, res) => res.json({ service: 'arcade-hub-server', status: 'online', games: [...GAMES] }))

const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS.includes('*') ? true : ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e5,
})

// ── Handshake auth ─────────────────────────────────────────────────────────
io.use(async (socket, next) => {
  try {
    const auth = socket.handshake.auth || {}
    const idToken = String(auth.idToken || '')
    let uid = sanitizeUid(auth.uid)
    let username = sanitizeUsername(auth.username)

    if (admin) {
      if (!idToken) return next(new Error('auth-required'))
      const decoded = await admin.auth().verifyIdToken(idToken, true)
      uid = decoded.uid
      // Prefer the verified username from Firestore; fall back to the claim/handshake
      try {
        const snap = await admin.firestore().doc(`users/${uid}`).get()
        const dbName = snap.exists ? sanitizeUsername(snap.data().username) : null
        if (dbName) username = dbName
      } catch { /* keep handshake username */ }
    }
    if (!username) username = 'player_' + crypto.randomBytes(3).toString('hex')

    socket.data.uid = uid
    socket.data.username = username
    return next()
  } catch (err) {
    return next(new Error('auth-failed'))
  }
})

io.on('connection', (socket) => {
  const { uid, username } = socket.data
  socketIndex.set(socket.id, { uid, username })
  if (!uidToSocket.has(uid)) uidToSocket.set(uid, new Set())
  uidToSocket.get(uid).add(socket.id)
  socket.emit('room:event', { type: 'notice', message: `Connected as @${username}` })

  // ── create ──
  socket.on('room:create', (payload, ack) => {
    const cb = typeof ack === 'function' ? ack : () => {}
    const game = String(payload?.game || '').toLowerCase()
    if (!GAMES.has(game)) return cb({ ok: false, error: 'Unknown game.' })
    const host = { uid, username, socketId: socket.id }
    const room = createRoom(game, host)
    socket.join(room.code)
    return cb({ ok: true, code: room.code, state: room.state })
  })

  // ── join ──
  socket.on('room:join', (payload, ack) => {
    const cb = typeof ack === 'function' ? ack : () => {}
    const game = String(payload?.game || '').toLowerCase()
    const code = String(payload?.code || '').toUpperCase().trim()
    const room = rooms.get(code)
    if (!room) return cb({ ok: false, error: 'Room not found — check the code.' })
    if (room.game !== game) return cb({ ok: false, error: 'That code belongs to a different game.' })
    if (room.players.length >= 2) {
      if (room.players.some((p) => p.socketId === socket.id)) return cb({ ok: true, state: room.state })
      return cb({ ok: false, error: 'Room is full.' })
    }
    // Rejoin guard: same uid already seated → just re-attach socket
    const existing = room.players.findIndex((p) => p.uid === uid)
    if (existing !== -1) {
      room.players[existing] = { ...room.players[existing], socketId: socket.id }
    } else {
      room.players.push({ uid, username, socketId: socket.id })
    }
    socket.join(room.code)
    announceJoin(io, room)
    touch(room)
    broadcastState(io, room)
    return cb({ ok: true, state: room.state })
  })

  // ── tictactoe move ──
  socket.on('ttt:move', (payload) => {
    const ctx = roomForSocket(socket, payload?.code)
    if (!ctx) return socket.emit('room:event', { type: 'error', message: 'You are not in that room.' })
    const { room, seatIndex } = ctx
    const result = applyTttMove(room, seatIndex, Number(payload?.index))
    if (!result.ok) return socket.emit('room:event', { type: 'error', message: result.error })
    touch(room)
    broadcastState(io, room)
  })

  // ── rps pick ──
  socket.on('rps:pick', (payload) => {
    const ctx = roomForSocket(socket, payload?.code)
    if (!ctx) return socket.emit('room:event', { type: 'error', message: 'You are not in that room.' })
    const { room, seatIndex } = ctx
    const result = applyRpsPick(room, seatIndex, payload?.choice)
    if (!result.ok) return socket.emit('room:event', { type: 'error', message: result.error })
    touch(room)
    broadcastState(io, room)
  })

  // ── chat ──
  const chatBuckets = new Map()
  socket.on('room:chat', (payload) => {
    const nowTs = Date.now()
    const last = chatBuckets.get('last') || 0
    if (nowTs - last < 700) return // silent rate limit
    chatBuckets.set('last', nowTs)

    const ctx = roomForSocket(socket, payload?.code)
    if (!ctx) return
    const { text, flagged } = filterChat(payload?.text)
    if (!text) return
    emitToRoom(io, ctx.room.code, 'room:event', {
      type: 'chat', from: username, text, flagged, ts: nowTs,
    })
  })

  // ── rematch ──
  socket.on('room:rematch', (payload) => {
    const ctx = roomForSocket(socket, payload?.code)
    if (!ctx) return
    const { room } = ctx
    const s = room.state
    const gameOver = room.game === 'tictactoe' ? !!s.winner : !!s.matchWinner
    if (!gameOver) return socket.emit('room:event', { type: 'error', message: 'Finish the current match first.' })
    rpsPending.delete(room.code)
    const fresh = freshState(room)
    fresh.started = room.players.length === 2
    room.state = fresh
    touch(room)
    emitToRoom(io, room.code, 'room:event', { type: 'rematch', by: username })
    broadcastState(io, room)
  })

  // ── leave ──
  socket.on('room:leave', (payload) => {
    const ctx = roomForSocket(socket, payload?.code)
    if (ctx) removeSocketFromRoom(io, socket, ctx.room)
  })

  // ── invite ──
  socket.on('invite', async (payload) => {
    const toUsername = sanitizeUsername(payload?.toUsername)
    const game = String(payload?.game || '').toLowerCase()
    const code = String(payload?.code || '').toUpperCase().trim()
    if (!toUsername || !GAMES.has(game) || !code) return

    // 1) Live delivery if the friend is connected somewhere right now
    let delivered = false
    for (const [sockId, meta] of socketIndex.entries()) {
      if (meta?.username === toUsername) {
        io.to(sockId).emit('invite', { from: username, game, code })
        delivered = true
      }
    }

    // 2) FCM push for offline friends (needs service account + saved tokens)
    if (admin) {
      try {
        const db = admin.firestore()
        const snap = await db.collection('users').where('username', '==', toUsername).limit(1).get()
        if (!snap.empty) {
          const target = snap.docs[0]
          const tokens = Array.isArray(target.data().fcmTokens) ? target.data().fcmTokens : []
          if (tokens.length) {
            const message = {
              tokens,
              notification: {
                title: 'Game invite — Arcade Hub',
                body: `@${username} challenged you to ${game === 'tictactoe' ? 'Tic-Tac-Toe' : 'Rock Paper Scissors'}. Room ${code}`,
              },
              data: { type: 'game-invite', game, code, from: username },
              android: { priority: 'high' },
              apns: { headers: { 'apns-priority': '10' } },
              webpush: { fcmOptions: { link: './index.html#/game/' + game + '?room=' + code } },
            }
            const resp = await admin.messaging().sendEachForMulticast(message)
            // Prune dead tokens
            const dead = []
            resp.responses.forEach((r, i) => {
              if (!r.success && /not-found|invalid-argument|unregistered/i.test(String(r.error?.code || ''))) dead.push(tokens[i])
            })
            if (dead.length) {
              const alive = tokens.filter((t) => !dead.includes(t))
              await target.ref.set({ fcmTokens: alive }, { merge: true })
            }
            delivered = delivered || resp.successCount > 0
          }
        }
      } catch (err) {
        console.error('[Arcade Hub] FCM invite failed:', err.message)
      }
    }

    socket.emit('room:event', {
      type: 'notice',
      message: delivered
        ? `Invite sent to @${toUsername}.`
        : `@${toUsername} isn't online right now — they'll see it in Notifications.`,
    })
  })

  // ── disconnect ──
  socket.on('disconnect', () => {
    const meta = socketIndex.get(socket.id)
    socketIndex.delete(socket.id)
    if (meta) {
      const set = uidToSocket.get(meta.uid)
      if (set) {
        set.delete(socket.id)
        if (set.size === 0) uidToSocket.delete(meta.uid)
      }
    }
    // Remove the disconnecting socket from every room it sat in
    for (const room of [...rooms.values()]) {
      if (room.players.some((p) => p.socketId === socket.id)) {
        removeSocketFromRoom(io, socket, room)
      }
    }
  })
})

// ── Idle room sweep ────────────────────────────────────────────────────────
setInterval(() => {
  const cutoff = Date.now() - ROOM_TTL_MS
  for (const [code, room] of rooms) {
    if (room.updatedAt < cutoff) {
      rooms.delete(code)
      rpsPending.delete(code)
    }
  }
}, 10 * 60 * 1000).unref()

server.listen(PORT, () => {
  console.log(`[Arcade Hub] multiplayer server listening on :${PORT} (origins: ${ALLOWED_ORIGINS.join(', ')})`)
})
