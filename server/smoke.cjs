// Smoke test: boots against a running server on :3001
const { io } = require('socket.io-client')
const URL = 'http://127.0.0.1:3001'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const once = (sock, ev) => new Promise((res) => sock.once(ev, res))
const ack = (sock, ev, payload) => new Promise((res) => sock.emit(ev, payload, res))

;(async () => {
  const log = []
  const note = (m) => { log.push(m); console.log('•', m) }

  const a = io(URL, { auth: { uid: 'uidA', username: 'alice_01' }, transports: ['websocket'] })
  const b = io(URL, { auth: { uid: 'uidB', username: 'bob_99' }, transports: ['websocket'] })
  await Promise.all([once(a, 'connect'), once(b, 'connect')])
  note('both clients connected')

  // ── TTT flow ──
  const create = await ack(a, 'room:create', { game: 'tictactoe' })
  if (!create.ok) throw new Error('create failed')
  note('room created: ' + create.code)

  const bStates = []
  b.on('room:state', (s) => bStates.push(s))
  const join = await ack(b, 'room:join', { game: 'tictactoe', code: create.code })
  if (!join.ok) throw new Error('join failed: ' + join.error)
  note('join ack ok, state started=' + join.state.started)
  await wait(120)

  // A is X — X moves first
  a.emit('ttt:move', { code: create.code, index: 0 })
  await wait(120)
  b.emit('ttt:move', { code: create.code, index: 3 }) // O moves after X — ok
  await wait(120)
  a.emit('ttt:move', { code: create.code, index: 1 })
  await wait(120)
  b.emit('ttt:move', { code: create.code, index: 4 })
  await wait(120)
  a.emit('ttt:move', { code: create.code, index: 2 }) // X wins top row
  await wait(150)
  const lastState = bStates[bStates.length - 1]
  note('ttt winner = ' + (lastState && lastState.winner))
  if (lastState?.winner !== 'X') throw new Error('expected X to win, got ' + JSON.stringify(lastState))

  // Out-of-turn enforcement test: fresh room, B tries to move first
  const c2 = await ack(a, 'room:create', { game: 'tictactoe' })
  await ack(b, 'room:join', { game: 'tictactoe', code: c2.code })
  let errMsg = null
  b.once('room:event', (e) => { if (e.type === 'error') errMsg = e.message })
  b.emit('ttt:move', { code: c2.code, index: 4 }) // B is O, X must start
  await wait(120)
  note('out-of-turn correctly rejected: ' + errMsg)
  if (!errMsg) throw new Error('out-of-turn was not rejected')

  // ── RPS flow ──
  const r = await ack(a, 'room:create', { game: 'rpsonline' })
  await ack(b, 'room:join', { game: 'rpsonline', code: r.code })
  const rpsStates = []
  a.on('room:state', (s) => { if (s.game === 'rpsonline') rpsStates.push(s) })
  a.emit('rps:pick', { code: r.code, choice: 'rock' })
  await wait(120)
  b.emit('rps:pick', { code: r.code, choice: 'scissors' })
  await wait(150)
  let st = rpsStates[rpsStates.length - 1]
  note(`rps round1 reveal x=${st?.reveal?.x} o=${st?.reveal?.o} winner=${st?.reveal?.roundWinner} wins=${JSON.stringify(st?.wins)} round=${st?.round}`)
  if (st?.reveal?.roundWinner !== 'X') throw new Error('rps round 1 winner wrong')
  a.emit('rps:pick', { code: r.code, choice: 'rock' })
  await wait(100)
  b.emit('rps:pick', { code: r.code, choice: 'paper' })
  await wait(120)
  a.emit('rps:pick', { code: r.code, choice: 'scissors' })
  await wait(100)
  b.emit('rps:pick', { code: r.code, choice: 'scissors' })
  await wait(150)
  st = rpsStates[rpsStates.length - 1]
  note(`rps round3 reveal winner=${st?.reveal?.roundWinner} wins=${JSON.stringify(st?.wins)} match=${st?.matchWinner}`)
  a.emit('rps:pick', { code: r.code, choice: 'paper' })
  await wait(100)
  b.emit('rps:pick', { code: r.code, choice: 'rock' })
  await wait(150)
  st = rpsStates[rpsStates.length - 1]
  note(`rps final wins=${JSON.stringify(st?.wins)} matchWinner=${st?.matchWinner}`)
  if (st?.matchWinner !== 'X') throw new Error('expected X to win match, got ' + JSON.stringify(st?.matchWinner))

  // ── chat abuse filter ──
  let chatMsg = null
  b.once('room:event', (e) => { if (e.type === 'chat') chatMsg = e })
  a.emit('room:chat', { code: r.code, text: 'hello you fucking noob' })
  await wait(120)
  note('chat filtered text: ' + chatMsg?.text + ' (flagged=' + chatMsg?.flagged + ')')
  if (!chatMsg?.flagged) throw new Error('abuse filter did not flag')

  // ── invite relay (online) ──
  let inviteMsg = null
  b.once('invite', (m) => { inviteMsg = m })
  a.emit('invite', { toUsername: 'bob_99', game: 'tictactoe', code: create.code })
  await wait(150)
  note('invite received by bob: ' + JSON.stringify(inviteMsg))
  if (inviteMsg?.from !== 'alice_01') throw new Error('invite not delivered')

  // ── leave → survivor sees player-left ──
  const leftP = once(b, 'room:event')
  a.emit('room:leave', { code: r.code })
  const leftEv = await Promise.race([leftP, wait(120).then(() => null)])
  note('leave event: ' + JSON.stringify(leftEv))

  a.close(); b.close()
  console.log('\nSMOKE TEST PASSED')
  process.exit(0)
})().catch((e) => { console.error('SMOKE TEST FAILED:', e.message); process.exit(1) })
