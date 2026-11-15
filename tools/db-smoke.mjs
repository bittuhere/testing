// Exercise the demo-mode (localStorage) data layer end-to-end in Node.
import { JSDOM } from 'jsdom'

const dom = new JSDOM('', { url: 'http://localhost/' })
const g = globalThis
g.window = dom.window
g.localStorage = dom.window.localStorage
g.sessionStorage = dom.window.sessionStorage
g.document = dom.window.document
g.navigator = dom.window.navigator
g.dispatchEvent = () => {}
dom.window.dispatchEvent = () => {}

const db = await import('./src/services/db.js')

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1) } else console.log('ok:', msg) }
const errMsg = async (p) => { try { await p } catch (e) { return e.userMessage || e.message } return null }

// ── signup two users ──
const u1 = await db.signUpWithEmail({ username: 'anurag', email: 'anurag@example.com', password: 'hunter2' })
assert(u1.username === 'anurag', 'signup user 1 (operator by username)')
const u2 = await db.signUpWithEmail({ username: 'alice_01', email: 'alice@example.com', password: 'alicepw' })
assert(u2.username === 'alice_01', 'signup user 2')
assert((await errMsg(db.signUpWithEmail({ username: 'alice_01', email: 'other@example.com', password: 'xxxx' }))) !== null, 'duplicate username rejected')

// ── sign-in / wrong password ──
await db.signOutUser()
const s1 = await db.signInWithIdentifier('ANURAG', 'hunter2')
assert(s1.username === 'anurag', 'case-insensitive sign-in')
assert((await errMsg(db.signInWithIdentifier('anurag', 'wrongpw'))) !== null, 'wrong password rejected')
await db.signOutUser()
const s1b = await db.signInWithIdentifier('anurag@example.com', 'hunter2')
assert(s1b.username === 'anurag', 'sign-in by email')

// ── leaderboard: submit + read back ──
await db.submitScore('pacman', 1234)
const lb = await db.getLeaderboard('pacman', 10)
assert(lb.length === 1 && lb[0].best === 1234 && lb[0].username === 'anurag', 'leaderboard entry written')
const mine = await db.getMyGameStat('pacman')
assert(mine.best === 1234 && mine.plays === 1, 'getMyGameStat')

// ── chat: send global message, verify 14-day expiry filter shape ──
const msg = await db.sendMessage('global', 'classic arcade night <@123>')
assert(msg.fromName === 'anurag', 'message sent with metadata')
const msgs = await db.fetchMessages('global', 10)
assert(msgs.length === 1, 'message list returns the message')

// ── friends ──
await db.signOutUser()
await db.signInWithIdentifier('alice_01', 'alicepw')
await db.sendFriendRequest('anurag')
const reqs = await db.listFriendRequests()
assert(reqs.incoming.length === 1 || reqs.outgoing.length === 1, 'friend request visible')
await db.signOutUser()
await db.signInWithIdentifier('anurag', 'hunter2')
const reqs2 = await db.listFriendRequests()
assert(reqs2.incoming.length === 1, 'incoming request for anurag')
await db.respondFriendRequest(reqs2.incoming[0].id, true)
const friends = await db.listFriends()
assert(friends.length === 1 && friends[0].username === 'alice_01', 'friend accepted')

// ── notifications ──
await db.sendPrivateNotification({ targetUids: [friends[0].uid], title: 'hi', body: 'hello alice', type: 'private' })
await db.markNotificationsRead('all')
const mineNotifs = await db.listMyNotifications(10)
assert(mineNotifs.private.length === 0, 'sender does not see private note targeted at friend (correct)')
await db.signOutUser()
await db.signInWithIdentifier('alice_01', 'alicepw')
const aliceNotifs = await db.listMyNotifications(10)
assert(aliceNotifs.private.length === 1 && aliceNotifs.private[0].body === 'hello alice', 'recipient sees the private notification')
await db.markNotificationsRead('all')
await db.signOutUser()
await db.signInWithIdentifier('anurag', 'hunter2')

// ── operator functions ──
const users = await db.adminListUsers({ search: '' })
assert(users.length === 2, 'admin list users')
const stats = await db.adminStats()
assert(stats.users === 2, 'admin stats')
const cleared = await errMsg(db.adminClearLeaderboard('pacman')) // operator → should succeed (returns undefined)
assert(cleared === null || cleared === undefined, 'operator can clear leaderboard')
const lbAfter = await db.getLeaderboard('pacman', 10)
assert(lbAfter.length === 0, 'leaderboard cleared by operator')

// ── ban blocks scoring ──
await db.adminSetBanned(friends[0].uid, true)
await db.signOutUser()
await db.signInWithIdentifier('alice_01', 'alicepw')
const banErr = await errMsg(db.submitScore('pacman', 99))
assert(banErr && /banned/i.test(banErr), 'banned user cannot submit score')
await db.signOutUser()
await db.signInWithIdentifier('anurag', 'hunter2')
await db.adminSetBanned(friends[0].uid, false)

console.log('\nALL DATA-LAYER SMOKE TESTS PASSED')
process.exit(0)
