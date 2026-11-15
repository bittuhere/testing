// Arcade Hub — socket client for the multiplayer backend (Node.js on Render)
// Protocol implemented by server/index.js:
//   client → server  'room:create' {game}            → ack {code}
//   client → server  'room:join'   {game, code}      → ack {ok, state} | ack {error}
//   client → server  'ttt:move'    {code, index}     → server validates (turn, cell free) & broadcasts
//   client → server  'rps:pick'    {code, choice}    → server stores pick; reveals when both picked
//   client → server  'room:leave'  {code}
//   client → server  'room:rematch'{code}
//   client → server  'room:chat'   {code, text}
//   client → server  'invite'      {toUsername, game, code}
//   server → client  'room:state'  {state}
//   server → client  'room:event'  {type, ...}       // 'player-joined' | 'player-left' | 'rematch' | 'chat'
//   server → client  'invite'      {from, game, code}
import { io } from 'socket.io-client'
import CONFIG, { isSocketConfigured } from '../config.js'
import { auth, isFirebaseConfigured } from '../firebase.js'

let socket = null
let boundUser = null

/** Get (or lazily create) the shared socket connection for a signed-in user. */
export function getSocket(user) {
  if (!isSocketConfigured) return null
  if (socket && boundUser === user?.uid) return socket
  if (socket) { socket.removeAllListeners(); socket.disconnect(); socket = null }

  socket = io(CONFIG.socketUrl, {
    transports: ['websocket', 'polling'],
    // socket.io supports a callback for auth — fetch a fresh Firebase ID token
    // on every (re)connect so the server can verify it when firebase-admin is set.
    auth: (cb) => {
      const finish = (idToken) => cb({ uid: user?.uid, username: user?.username, idToken: idToken || '' })
      try {
        if (isFirebaseConfigured && auth?.currentUser) {
          auth.currentUser.getIdToken().then(finish, () => finish(''))
        } else {
          finish('')
        }
      } catch { finish('') }
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    timeout: 10000,
  })
  boundUser = user?.uid || null
  return socket
}

export function closeSocket() {
  if (socket) { socket.removeAllListeners(); socket.disconnect() }
  socket = null
  boundUser = null
}

/** Promise wrapper around socket.emit with ack. */
export function emitAck(sock, event, payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (!sock || !sock.connected) {
      // Give a brief moment for the initial connection to establish
      if (!sock) return reject(new Error('Multiplayer server is not reachable. Try again in a moment.'))
      const onConnect = () => { sock.off('connect', onConnect); emitAck(sock, event, payload, timeoutMs).then(resolve, reject) }
      sock.once('connect', onConnect)
      return
    }
    const timer = setTimeout(() => reject(new Error('The server took too long to respond.')), timeoutMs)
    sock.emit(event, payload, (response) => {
      clearTimeout(timer)
      resolve(response)
    })
  })
}

export { isSocketConfigured }
