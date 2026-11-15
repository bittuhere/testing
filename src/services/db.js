// Arcade Hub — unified data layer
// ─────────────────────────────────────────────────────────────────────────────
// Every backend operation in the app goes through this module.
//   • Firebase mode  (src/config.js has real credentials): Firestore + Firebase Auth
//   • Local Demo Mode (credentials left as YOUR_*): identical API backed by
//     localStorage, so the production build can be tried end-to-end offline.
// All errors are thrown as Error with a human-friendly `.userMessage`.
// ─────────────────────────────────────────────────────────────────────────────
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  linkWithCredential,
  EmailAuthProvider,
} from 'firebase/auth'
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  query, where, limit as qLimit, arrayUnion, runTransaction, increment, writeBatch,
  onSnapshot, Timestamp,
} from 'firebase/firestore'

import CONFIG, { isFirebaseConfigured } from '../config.js'
import { auth, db, googleProvider } from '../firebase.js'
import {
  normalizeUsername, sha256, verifyPasswordHash,
  avatarColorFor, threadIdFor,
} from '../utils/validation.js'
import { filterMessage } from '../utils/abuse.js'

const err = (userMessage, cause) => {
  const e = new Error(cause || userMessage)
  e.userMessage = userMessage
  return e
}

/** Operator check that also honours CONFIG.operators (covers legacy accounts without role set). */
const isOperatorProfile = (cur) =>
  !!cur && (cur.role === 'operator' || CONFIG.operators.includes(normalizeUsername(cur.username || '')))

export const mode = isFirebaseConfigured ? 'firebase' : 'local'

// ════════════════════════════════════════════════════════════════════════════
// LOCAL DEMO BACKEND (localStorage)
// ════════════════════════════════════════════════════════════════════════════
const LS = {
  session: 'ah.local.session',
  users: 'ah.local.users',
  secrets: 'ah.local.secrets',
  usernames: 'ah.local.usernames',
  scores: 'ah.local.scores',
  messages: 'ah.local.messages',
  friendReqs: 'ah.local.friendReqs',
  notifications: 'ah.local.notifications',
  contact: 'ah.local.contact',
  settings: 'ah.local.settings',
}
const lsRead = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}
const lsWrite = (key, value) => localStorage.setItem(key, JSON.stringify(value))
const lsUsers = () => lsRead(LS.users, {})
const lsSecrets = () => lsRead(LS.secrets, {})
const lsUsernames = () => lsRead(LS.usernames, {})
const uid = () => 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
const now = () => Date.now()
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000

// ════════════════════════════════════════════════════════════════════════════
// AUTH & PROFILES
// ════════════════════════════════════════════════════════════════════════════

function publicProfile(p) {
  if (!p) return null
  const { appHash, password, ...rest } = p
  return rest
}

export async function getProfile(uid_) {
  if (!isFirebaseConfigured) return publicProfile(lsUsers()[uid_] || null)
  const snap = await getDoc(doc(db, 'users', uid_))
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null
}

export async function getProfileByUsername(username) {
  const u = normalizeUsername(username)
  if (!isFirebaseConfigured) {
    const uid_ = lsUsernames()[u]
    return uid_ ? publicProfile(lsUsers()[uid_] || null) : null
  }
  const uname = await getDoc(doc(db, 'usernames', u))
  if (!uname.exists()) return null
  return getProfile(uname.data().uid)
}

export async function usernameAvailable(username) {
  const u = normalizeUsername(username)
  if (!isFirebaseConfigured) return !lsUsernames()[u]
  const uname = await getDoc(doc(db, 'usernames', u))
  return !uname.exists()
}

export async function searchProfiles(rawQuery, max = 8) {
  const qtext = normalizeUsername(rawQuery)
  if (!qtext) return []
  if (!isFirebaseConfigured) {
    return Object.values(lsUsers())
      .filter((p) => p.username.startsWith(qtext))
      .slice(0, max)
      .map(publicProfile)
  }
  const col = collection(db, 'usernames')
  const snap = await getDocs(query(col, where('__name__', '>=', qtext), where('__name__', '<=', qtext + ''), qLimit(max)))
  const results = []
  for (const d of snap.docs) {
    const p = await getProfile(d.data().uid)
    if (p) results.push(p)
  }
  return results
}

function buildProfile({ uid: uid_, username, email, provider }) {
  return {
    uid: uid_,
    username: normalizeUsername(username),
    email: String(email || '').toLowerCase(),
    bio: '',
    favoriteGame: '',
    avatarColor: avatarColorFor(username),
    role: CONFIG.operators.includes(normalizeUsername(username)) ? 'operator' : 'user',
    banned: false,
    muted: false,
    verified: true,
    provider: provider || 'password',
    createdAt: now(),
    online: true,
    lastSeen: now(),
    friendIds: [],
    stats: { plays: 0, totalScore: 0 },
  }
}

export async function signUpWithEmail({ username, email, password }) {
  const u = normalizeUsername(username)
  const em = String(email || '').trim().toLowerCase()
  if (!(await usernameAvailable(u))) throw err('That username is already taken. Try another one.')

  if (!isFirebaseConfigured) {
    const users = lsUsers()
    const emailTaken = Object.values(users).some((p) => p.email === em)
    if (emailTaken) throw err('An account with that email already exists. Try signing in.')
    const id = uid()
    const profile = buildProfile({ uid: id, username: u, email: em, provider: 'password' })
    users[id] = profile
    lsWrite(LS.users, users)
    const secrets = lsSecrets()
    secrets[id] = { appHash: sha256(password), provider: 'password' } // SHA-256 from day one
    lsWrite(LS.secrets, secrets)
    const un = lsUsernames(); un[u] = id; lsWrite(LS.usernames, un)
    lsWrite(LS.session, id)
    window.dispatchEvent(new Event('ah:auth'))
    return publicProfile(profile)
  }

  // Real signup — Firebase Auth creates the account, we add our own records
  let cred
  try {
    cred = await createUserWithEmailAndPassword(auth, em, password)
  } catch (e) {
    if (e?.code === 'auth/email-already-in-use') throw err('An account with that email already exists. Try signing in.', e)
    if (e?.code === 'auth/invalid-email') throw err('That email address is not valid.', e)
    if (e?.code === 'auth/weak-password') throw err('Password should be at least 6 characters for Firebase.', e)
    throw err(e?.message || 'Could not create your account. Please try again.', e)
  }
  const profile = buildProfile({ uid: cred.user.uid, username: u, email: em, provider: 'password' })
  try {
    await setDoc(doc(db, 'users', cred.user.uid), profile)
    // No client-side password hash — Firebase Auth is the credential store.
    // Legacy appHash (SHA-1) records are verified/migrated server-side only.
    await setDoc(doc(db, 'usernames', u), { uid: cred.user.uid, createdAt: now() })
    // emailIndex is server-side only — the Render server resolves identifiers via users.email (admin).
  } catch (e) {
    // Roll back the auth account so a dangling auth user doesn't block retries
    try { await cred.user.delete() } catch { /* best effort */ }
    throw err('Could not finish setting up your account (profile write failed). Please try again.', e)
  }
  return publicProfile(profile)
}

/**
 * Resolve an identifier (username or email) to { profile, email } without
 * ever creating or probing accounts. Returns null when unknown.
 */
/** Ask the trusted multiplayer server to resolve the identifier and verify the
 * app-level hash (transparently upgrading SHA-1 → SHA-256 on success).
 * The client never reads the secrets collection directly. */
async function verifyPasswordGate(id, password) {
  if (!CONFIG.socketUrl) return { denied: false, email: null }
  try {
    const res = await fetch(`${CONFIG.socketUrl.replace(/\/+$/, '')}/verify-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: id, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { denied: false, email: null } // server trouble — Firebase decides
    if (data?.ok === false) return { denied: true, email: null }
    return { denied: false, email: typeof data?.email === 'string' ? data.email : null }
  } catch {
    return { denied: false, email: null } // unreachable — Firebase decides
  }
}

export async function signInWithIdentifier(identifier, password) {
  const id = String(identifier || '').trim().toLowerCase()

  if (!isFirebaseConfigured) {
    const users = lsUsers()
    let profile = null
    if (id.includes('@')) profile = Object.values(users).find((p) => p.email === id) || null
    else {
      const uid_ = lsUsernames()[normalizeUsername(id)]
      profile = uid_ ? users[uid_] : null
    }
    if (!profile) throw err('No account found with that username/email.')
    const secret = lsSecrets()[profile.uid]
    if (!secret?.appHash) throw err('This account has no password set. Use “Continue with Google”.')
    const { ok, migratedHash } = verifyPasswordHash(password, secret.appHash)
    if (!ok) throw err('Incorrect password. Please try again.')
    if (migratedHash) { const s = lsSecrets(); s[profile.uid] = { ...secret, appHash: migratedHash }; lsWrite(LS.secrets, s) }
    const users2 = lsUsers()
    users2[profile.uid] = { ...profile, online: true, lastSeen: now() }
    lsWrite(LS.users, users2)
    lsWrite(LS.session, profile.uid)
    window.dispatchEvent(new Event('ah:auth'))
    return publicProfile(users2[profile.uid])
  }

  // Legacy hash gate: the server resolves the identifier and verifies the
  // app-level SHA-1/SHA-256 hash (migrating SHA-1 → SHA-256 transparently),
  // returning the account's email for Firebase Auth. Secrets stay server-side.
  const gate = await verifyPasswordGate(id, password)
  if (gate.denied) throw err('Incorrect password. Please try again.')

  const emailToUse = gate.email || (id.includes('@') ? id : null)
  if (!emailToUse) {
    throw err('Please sign in with your email address. (Username sign-in needs the multiplayer server — see server/README.md.)')
  }
  try {
    const cred = await signInWithEmailAndPassword(auth, emailToUse, password)
    const profile = await getProfile(cred.user.uid)
    if (!profile) {
      try { await signOut(auth) } catch { /* ignore */ }
      throw err('Your login works but your Arcade Hub profile is missing. Contact the operator.')
    }
    await updateDoc(doc(db, 'users', profile.uid), { online: true, lastSeen: now() }).catch(() => {})
    return { ...profile, online: true, lastSeen: now() }
  } catch (e) {
    if (e?.userMessage) throw e
    if (e?.code === 'auth/user-not-found' || e?.code === 'auth/invalid-credential' || e?.code === 'auth/wrong-password') {
      throw err('Incorrect password or account not found. Please try again.', e)
    }
    throw err('Could not sign you in. Please try again.', e)
  }
}

export async function signInWithGoogle() {
  if (!isFirebaseConfigured) {
    // Local demo: simulate a Google session that must still pick a username+password
    const id = 'u_google_demo'
    lsWrite(LS.session, id)
    window.dispatchEvent(new Event('ah:auth'))
    return { profile: publicProfile(lsUsers()[id] || null), needsProfile: !lsUsers()[id] }
  }
  let cred
  try {
    cred = await signInWithPopup(auth, googleProvider)
  } catch (e) {
    if (e?.code === 'auth/popup-closed-by-user') throw err('Google sign-in was cancelled.', e)
    if (e?.code === 'auth/popup-blocked') throw err('The popup was blocked. Allow popups for this site and try again.', e)
    throw err(e?.message || 'Google sign-in failed. Please try again.', e)
  }
  const existing = await getProfile(cred.user.uid)
  if (existing) {
    await updateDoc(doc(db, 'users', cred.user.uid), { online: true, lastSeen: now() }).catch(() => {})
    return { profile: existing, needsProfile: false }
  }
  return { profile: null, needsProfile: true }
}

/** After any first-time Google sign-in, the user must still pick a username + password. */
export async function completeGoogleProfile({ username, password }) {
  const u = normalizeUsername(username)
  if (!(await usernameAvailable(u))) throw err('That username is already taken. Try another one.')

  if (!isFirebaseConfigured) {
    const users = lsUsers()
    const id = 'u_google_demo'
    const profile = buildProfile({ uid: id, username: u, email: 'google.demo@gmail.com', provider: 'google' })
    users[id] = profile
    lsWrite(LS.users, users)
    const s = lsSecrets(); s[id] = { appHash: sha256(password), provider: 'google' }; lsWrite(LS.secrets, s)
    const un = lsUsernames(); un[u] = id; lsWrite(LS.usernames, un)
    lsWrite(LS.session, id)
    window.dispatchEvent(new Event('ah:auth'))
    return publicProfile(profile)
  }

  const user = auth.currentUser
  if (!user) throw err('Your Google session expired. Please sign in again.')
  const email = (user.email || '').toLowerCase()
  const profile = buildProfile({ uid: user.uid, username: u, email, provider: 'google' })
  try {
    await setDoc(doc(db, 'users', user.uid), profile)
    await setDoc(doc(db, 'usernames', u), { uid: user.uid, createdAt: now() })
    // emailIndex is server-side only — the Render server resolves identifiers via users.email (admin).
    // Password is linked into Firebase Auth below (linkWithCredential) — nothing else to store.
  } catch (e) {
    throw err('Could not create your profile. Please try again.', e)
  }
  try {
    await linkWithCredential(user, EmailAuthProvider.credential(email, password))
  } catch (e) {
    if (e?.code === 'auth/provider-already-linked' || e?.code === 'auth/credential-already-in-use') {
      // Account already had a password — that's fine, sign-in keeps working via Google
    } else if (e?.code === 'auth/requires-recent-login') {
      // Not fatal: profile exists, app password stored. They can also keep using Google.
      console.warn('Could not link password credential (needs recent login).', e)
    } else {
      console.warn('Password linking failed:', e)
    }
  }
  return publicProfile(profile)
}

export async function signOutUser() {
  const cur = await thisGetCurrent()
  if (cur) {
    if (isFirebaseConfigured) await updateDoc(doc(db, 'users', cur.uid), { online: false, lastSeen: now() }).catch(() => {})
    else { const users = lsUsers(); if (users[cur.uid]) { users[cur.uid].online = false; lsWrite(LS.users, users) } }
  }
  if (isFirebaseConfigured) { await signOut(auth) }
  else { lsWrite(LS.session, null) }
  window.dispatchEvent(new Event('ah:auth'))
}

async function thisGetCurrent() {
  if (!isFirebaseConfigured) {
    const id = lsRead(LS.session, null)
    return id ? publicProfile(lsUsers()[id] || null) : null
  }
  if (!auth.currentUser) return null
  return getProfile(auth.currentUser.uid)
}

/** Subscribe to auth state. Callback receives a full profile or null. Returns unsubscribe. */
export function subscribeAuth(cb) {
  if (!isFirebaseConfigured) {
    const handler = () => thisGetCurrent().then(cb)
    handler()
    window.addEventListener('ah:auth', handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('ah:auth', handler)
      window.removeEventListener('storage', handler)
    }
  }
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return cb(null)
    try { cb(await getProfile(user.uid)) } catch { cb(null) }
  })
}

export function getCurrentProfileAsync() { return thisGetCurrent() }

export async function updateMyProfile(partial) {
  const cur = await thisGetCurrent()
  if (!cur) throw err('You must be signed in.')
  const allowed = {}
  for (const key of ['bio', 'favoriteGame', 'avatarColor', 'displayName']) {
    if (partial[key] !== undefined) allowed[key] = partial[key]
  }
  if (allowed.bio !== undefined) allowed.bio = String(allowed.bio).slice(0, 160)
  if (!isFirebaseConfigured) {
    const users = lsUsers()
    users[cur.uid] = { ...users[cur.uid], ...allowed }
    lsWrite(LS.users, users)
    window.dispatchEvent(new Event('ah:auth'))
    return publicProfile(users[cur.uid])
  }
  await updateDoc(doc(db, 'users', cur.uid), allowed)
  return getProfile(cur.uid)
}

export async function setPresence(online) {
  const cur = await thisGetCurrent()
  if (!cur) return
  const payload = { online: !!online, lastSeen: now() }
  if (isFirebaseConfigured) await updateDoc(doc(db, 'users', cur.uid), payload).catch(() => {})
  else { const users = lsUsers(); if (users[cur.uid]) { users[cur.uid] = { ...users[cur.uid], ...payload }; lsWrite(LS.users, users) } }
}

// ════════════════════════════════════════════════════════════════════════════
// LEADERBOARDS
// ════════════════════════════════════════════════════════════════════════════
export async function submitScore(gameId, score) {
  const value = Math.floor(Number(score) || 0)
  if (value < 0 || value > 10_000_000) throw err('That score does not look valid.')
  const cur = await thisGetCurrent()
  if (!cur) throw err('Sign in to save your score to the leaderboard.')
  if (cur.banned) throw err('Your account is banned, so scores cannot be saved.')

  if (!isFirebaseConfigured) {
    const scores = lsRead(LS.scores, [])
    const entry = scores.find((s) => s.gameId === gameId && s.uid === cur.uid)
    const prevBest = entry?.best || 0
    const isNewBest = value > prevBest
    if (entry) { entry.best = Math.max(prevBest, value); entry.plays += 1; entry.ts = now(); entry.username = cur.username; entry.avatarColor = cur.avatarColor }
    else scores.push({ gameId, uid: cur.uid, username: cur.username, avatarColor: cur.avatarColor, best: value, plays: 1, ts: now() })
    lsWrite(LS.scores, scores)
    return { best: Math.max(prevBest, value), isNewBest, plays: entry?.plays || 1 }
  }

  const ref = doc(db, 'leaderboards', gameId, 'entries', cur.uid)
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const prev = snap.exists() ? snap.data() : null
    const prevBest = prev?.best || 0
    const isNewBest = value > prevBest
    tx.set(ref, {
      username: cur.username,
      avatarColor: cur.avatarColor || avatarColorFor(cur.username),
      best: Math.max(prevBest, value),
      plays: increment(1),
      ts: now(),
    }, { merge: true })
    return { best: Math.max(prevBest, value), isNewBest }
  })
  await updateDoc(doc(db, 'users', cur.uid), {
    'stats.plays': increment(1),
    'stats.totalScore': increment(value),
  }).catch(() => {})
  return { ...result, plays: undefined }
}

export async function getLeaderboard(gameId, max = 100) {
  if (!isFirebaseConfigured) {
    return lsRead(LS.scores, [])
      .filter((s) => s.gameId === gameId)
      .sort((a, b) => b.best - a.best || a.ts - b.ts)
      .slice(0, max)
  }
  const col = collection(db, 'leaderboards', gameId, 'entries')
  const snap = await getDocs(query(col, qLimit(200)))
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .sort((a, b) => b.best - a.best || a.ts - b.ts)
    .slice(0, max)
}

export async function getMyGameStat(gameId) {
  const cur = await thisGetCurrent()
  if (!cur) return null
  if (!isFirebaseConfigured) {
    const entry = lsRead(LS.scores, []).find((s) => s.gameId === gameId && s.uid === cur.uid)
    return entry ? { best: entry.best, plays: entry.plays } : null
  }
  const snap = await getDoc(doc(db, 'leaderboards', gameId, 'entries', cur.uid))
  return snap.exists() ? { best: snap.data().best, plays: snap.data().plays } : null
}

// ════════════════════════════════════════════════════════════════════════════
// CHAT (global + direct messages) — messages auto-expire after 14 days
// ════════════════════════════════════════════════════════════════════════════
export function dmChannelId(a, b) { return 'dm:' + threadIdFor(a, b) }
export const GLOBAL_CHANNEL = 'global'

export async function sendMessage(channel, rawText) {
  const cur = await thisGetCurrent()
  if (!cur) throw err('Sign in to chat.')
  if (cur.muted) throw err('Your chat access has been muted by a moderator.')
  if (cur.banned) throw err('Your account is banned.')
  const text = String(rawText || '').trim()
  if (!text) throw err('Type a message first.')
  if (text.length > 500) throw err('Messages are limited to 500 characters.')
  const { clean, flagged, hits } = filterMessage(text)
  const msg = {
    channel,
    from: cur.uid,
    fromName: cur.username,
    avatarColor: cur.avatarColor || avatarColorFor(cur.username),
    text: clean,
    flagged,
    hits: flagged ? hits : [],
    ts: now(),
    readBy: [cur.uid],
    expireAt: now() + FOURTEEN_DAYS,
  }
  if (!isFirebaseConfigured) {
    const all = lsRead(LS.messages, [])
    all.push({ id: uid(), ...msg })
    lsWrite(LS.messages, all.slice(-1500))
    window.dispatchEvent(new Event('ah:chat'))
    return { ...msg, id: 'local' }
  }
  // Firestore TTL policies need a Timestamp — write expireAt as one so the
  // 14-day auto-deletion (enabled in the console) actually fires. The ms number
  // stays in the demo path above.
  const ref = await addDoc(collection(db, 'messages'), { ...msg, expireAt: Timestamp.fromMillis(msg.expireAt) })
  return { id: ref.id, ...msg }
}

function visibleMessages(all, channel, max) {
  const cutoff = now() - FOURTEEN_DAYS
  return all
    .filter((m) => m.channel === channel && m.ts >= cutoff && !m.deleted)
    .sort((a, b) => a.ts - b.ts)
    .slice(-max)
}

export async function fetchMessages(channel, max = 100) {
  if (!isFirebaseConfigured) {
    return visibleMessages(lsRead(LS.messages, []), channel, max)
  }
  try {
    const snap = await getDocs(query(collection(db, 'messages'), where('channel', '==', channel), qLimit(300)))
    return visibleMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })), channel, max)
  } catch {
    return []
  }
}

/** Subscribe to a channel. cb(messagesArray). Returns unsubscribe. */
export function subscribeMessages(channel, cb, max = 100) {
  if (!isFirebaseConfigured) {
    const handler = () => fetchMessages(channel, max).then(cb)
    handler()
    const iv = setInterval(handler, 2500)
    window.addEventListener('ah:chat', handler)
    return () => { clearInterval(iv); window.removeEventListener('ah:chat', handler) }
  }
  try {
    return onSnapshot(
      query(collection(db, 'messages'), where('channel', '==', channel), qLimit(300)),
      (snap) => cb(visibleMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })), channel, max)),
      () => cb([])
    )
  } catch {
    cb([]); return () => {}
  }
}

export async function markChannelRead(channel) {
  const cur = await thisGetCurrent()
  if (!cur) return
  const msgs = await fetchMessages(channel, 100)
  const unread = msgs.filter((m) => !(m.readBy || []).includes(cur.uid))
  if (!unread.length) return
  if (!isFirebaseConfigured) {
    const all = lsRead(LS.messages, [])
    for (const m of all) {
      if (m.channel === channel && !(m.readBy || []).includes(cur.uid)) m.readBy = [...(m.readBy || []), cur.uid]
    }
    lsWrite(LS.messages, all)
    window.dispatchEvent(new Event('ah:chat'))
    return
  }
  const batch = writeBatch(db)
  for (const m of unread.slice(0, 400)) {
    batch.update(doc(db, 'messages', m.id), { readBy: arrayUnion(cur.uid) })
  }
  await batch.commit().catch(() => {})
}

export async function deleteMessage(message) {
  const cur = await thisGetCurrent()
  if (!cur) throw err('Sign in required.')
  const mine = message.from === cur.uid
  if (!mine && !isOperatorProfile(cur)) throw err('You can only delete your own messages.')
  if (!isFirebaseConfigured) {
    const all = lsRead(LS.messages, [])
    const next = all.filter((m) => m.id !== message.id)
    lsWrite(LS.messages, next)
    window.dispatchEvent(new Event('ah:chat'))
    return
  }
  await deleteDoc(doc(db, 'messages', message.id))
}

/** Unread counts for the signed-in user: { total, global, perThread: {channel:count} } */
export async function getUnreadCounts() {
  const cur = await thisGetCurrent()
  if (!cur) return { total: 0, global: 0, perThread: {} }
  const cutoff = now() - FOURTEEN_DAYS
  const countFor = (msgs) => msgs.filter((m) => m.ts >= cutoff && m.from !== cur.uid && !(m.readBy || []).includes(cur.uid)).length

  if (!isFirebaseConfigured) {
    const all = lsRead(LS.messages, [])
    const globalCount = countFor(all.filter((m) => m.channel === GLOBAL_CHANNEL))
    const perThread = {}
    for (const m of all) {
      if (m.channel?.startsWith('dm:') && m.channel.includes(cur.uid) && m.ts >= cutoff && m.from !== cur.uid && !(m.readBy || []).includes(cur.uid)) {
        perThread[m.channel] = (perThread[m.channel] || 0) + 1
      }
    }
    const total = globalCount + Object.values(perThread).reduce((a, b) => a + b, 0)
    return { total, global: globalCount, perThread }
  }

  const friendIds = await listFriendIds()
  const channels = [GLOBAL_CHANNEL, ...friendIds.map((fid) => dmChannelId(cur.uid, fid))]
  const perThread = {}
  let globalCount = 0
  for (const ch of channels) {
    try {
      const snap = await getDocs(query(collection(db, 'messages'), where('channel', '==', ch), qLimit(150)))
      const msgs = snap.docs.map((d) => d.data())
      const c = countFor(msgs)
      if (ch === GLOBAL_CHANNEL) globalCount = c
      else if (c) perThread[ch] = c
    } catch { /* channel unreadable — skip */ }
  }
  const total = globalCount + Object.values(perThread).reduce((a, b) => a + b, 0)
  return { total, global: globalCount, perThread }
}

// ════════════════════════════════════════════════════════════════════════════
// FRIENDS
// ════════════════════════════════════════════════════════════════════════════
export async function listFriendIds() {
  const cur = await thisGetCurrent()
  if (!cur) return []
  if (!isFirebaseConfigured) return lsUsers()[cur.uid]?.friendIds || []
  const snap = await getDoc(doc(db, 'users', cur.uid))
  return snap.exists() ? (snap.data().friendIds || []) : []
}

export async function listFriends() {
  const ids = await listFriendIds()
  const out = []
  for (const id of ids) { const p = await getProfile(id); if (p) out.push(p) }
  return out
}

export async function sendFriendRequest(targetUsername) {
  const cur = await thisGetCurrent()
  if (!cur) throw err('Sign in to add friends.')
  const target = await getProfileByUsername(targetUsername)
  if (!target) throw err('No player with that username exists.')
  if (target.uid === cur.uid) throw err('You cannot add yourself.')
  const ids = await listFriendIds()
  if (ids.includes(target.uid)) throw err('You are already friends with ' + target.username + '.')

  if (!isFirebaseConfigured) {
    const reqs = lsRead(LS.friendReqs, [])
    const dup = reqs.find((r) => r.status === 'pending' &&
      ((r.from === cur.uid && r.to === target.uid) || (r.from === target.uid && r.to === cur.uid)))
    if (dup) throw err('A friend request is already pending between you two.')
    reqs.push({ id: uid(), from: cur.uid, fromName: cur.username, avatarColor: cur.avatarColor, to: target.uid, toName: target.username, status: 'pending', ts: now() })
    lsWrite(LS.friendReqs, reqs)
    window.dispatchEvent(new Event('ah:friends'))
    return { ok: true }
  }
  const dup = await getDocs(query(collection(db, 'friendRequests'), where('from', '==', cur.uid), where('to', '==', target.uid), where('status', '==', 'pending'), qLimit(1)))
  if (!dup.empty) throw err('You already sent them a request. Waiting for a reply.')
  await addDoc(collection(db, 'friendRequests'), {
    from: cur.uid, fromName: cur.username, avatarColor: cur.avatarColor || avatarColorFor(cur.username),
    to: target.uid, toName: target.username, status: 'pending', ts: now(),
  })
  return { ok: true }
}

export async function listFriendRequests() {
  const cur = await thisGetCurrent()
  if (!cur) return { incoming: [], outgoing: [] }
  if (!isFirebaseConfigured) {
    const reqs = lsRead(LS.friendReqs, [])
    return {
      incoming: reqs.filter((r) => r.to === cur.uid && r.status === 'pending'),
      outgoing: reqs.filter((r) => r.from === cur.uid && r.status === 'pending'),
    }
  }
  const col = collection(db, 'friendRequests')
  const [inc, out] = await Promise.all([
    getDocs(query(col, where('to', '==', cur.uid), where('status', '==', 'pending'), qLimit(50))),
    getDocs(query(col, where('from', '==', cur.uid), where('status', '==', 'pending'), qLimit(50))),
  ])
  return {
    incoming: inc.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.ts - a.ts),
    outgoing: out.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.ts - a.ts),
  }
}

export async function respondFriendRequest(requestId, accept) {
  const cur = await thisGetCurrent()
  if (!cur) throw err('Sign in required.')
  if (!isFirebaseConfigured) {
    const reqs = lsRead(LS.friendReqs, [])
    const req = reqs.find((r) => r.id === requestId)
    if (!req || req.to !== cur.uid) throw err('Request not found.')
    req.status = accept ? 'accepted' : 'declined'
    if (accept) {
      const users = lsUsers()
      for (const [id, p] of Object.entries(users)) {
        if (id === req.from || id === req.to) {
          const other = id === req.from ? req.to : req.from
          if (!(p.friendIds || []).includes(other)) p.friendIds = [...(p.friendIds || []), other]
        }
      }
      lsWrite(LS.users, users)
    }
    lsWrite(LS.friendReqs, reqs)
    window.dispatchEvent(new Event('ah:friends'))
    window.dispatchEvent(new Event('ah:auth'))
    return { ok: true }
  }
  const reqRef = doc(db, 'friendRequests', requestId)
  const snap = await getDoc(reqRef)
  if (!snap.exists()) throw err('Request not found.')
  const req = snap.data()
  if (req.to !== cur.uid) throw err('This request is not addressed to you.')
  await updateDoc(reqRef, { status: accept ? 'accepted' : 'declined', resolvedAt: now() })
  if (accept) {
    const meRef = doc(db, 'users', req.to)
    const themRef = doc(db, 'users', req.from)
    await updateDoc(meRef, { friendIds: arrayUnion(req.from) })
    await updateDoc(themRef, { friendIds: arrayUnion(req.to) })
  }
  return { ok: true }
}

export async function removeFriend(friendUid) {
  const cur = await thisGetCurrent()
  if (!cur) throw err('Sign in required.')
  if (!isFirebaseConfigured) {
    const users = lsUsers()
    for (const id of [cur.uid, friendUid]) {
      if (users[id]) users[id].friendIds = (users[id].friendIds || []).filter((x) => x !== (id === cur.uid ? friendUid : cur.uid))
    }
    lsWrite(LS.users, users)
    window.dispatchEvent(new Event('ah:auth'))
    return
  }
  const meRef = doc(db, 'users', cur.uid)
  const themRef = doc(db, 'users', friendUid)
  const [me, them] = await Promise.all([getDoc(meRef), getDoc(themRef)])
  if (me.exists()) await updateDoc(meRef, { friendIds: (me.data().friendIds || []).filter((x) => x !== friendUid) })
  if (them.exists()) await updateDoc(themRef, { friendIds: (them.data().friendIds || []).filter((x) => x !== cur.uid) })
}

// ════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS (global broadcast + private targeted)
// ════════════════════════════════════════════════════════════════════════════
export async function sendGlobalNotification({ title, body }) {
  const cur = await thisGetCurrent()
  if (!isOperatorProfile(cur)) throw err('Only the operator can broadcast global notifications.')
  const note = {
    scope: 'global', targets: [], title: String(title).slice(0, 120), body: String(body).slice(0, 500),
    createdBy: cur.username, ts: now(), readBy: [],
  }
  if (!isFirebaseConfigured) {
    const all = lsRead(LS.notifications, [])
    all.push({ id: uid(), ...note })
    lsWrite(LS.notifications, all)
    window.dispatchEvent(new Event('ah:notifications'))
    return
  }
  await addDoc(collection(db, 'notifications'), note)
}

export async function sendPrivateNotification({ targetUids, title, body, type = 'private' }) {
  const cur = await thisGetCurrent()
  if (!cur) throw err('Sign in required.')
  const targets = [...new Set(targetUids)].filter(Boolean)
  if (!targets.length) throw err('Pick at least one player.')
  const note = {
    scope: 'private', targets, type, title: String(title).slice(0, 120), body: String(body).slice(0, 500),
    createdBy: cur.username, ts: now(), readBy: [],
  }
  if (!isFirebaseConfigured) {
    const all = lsRead(LS.notifications, [])
    all.push({ id: uid(), ...note })
    lsWrite(LS.notifications, all)
    window.dispatchEvent(new Event('ah:notifications'))
    return
  }
  await addDoc(collection(db, 'notifications'), note)
}

/** Game invite notification — used by friends & chat "Invite to game". */
export async function sendGameInvite({ targetUid, gameId, gameName, roomCode }) {
  const cur = await thisGetCurrent()
  if (!cur) throw err('Sign in to invite players.')
  const note = {
    scope: 'private', targets: [targetUid], type: 'invite',
    title: `${cur.username} invited you to play ${gameName}`,
    body: roomCode ? `Tap to join the match. Room code: ${roomCode}` : `Tap to open ${gameName} and create a room to play together.`,
    roomCode: roomCode || null, gameId,
    createdBy: cur.username, ts: now(), readBy: [],
  }
  if (!isFirebaseConfigured) {
    const all = lsRead(LS.notifications, [])
    all.push({ id: uid(), ...note })
    lsWrite(LS.notifications, all)
    window.dispatchEvent(new Event('ah:notifications'))
    return
  }
  await addDoc(collection(db, 'notifications'), note)
}

export async function listMyNotifications(max = 60) {
  const cur = await thisGetCurrent()
  if (!cur) return { global: [], private: [] }
  const cutoff = now() - 90 * 24 * 60 * 60 * 1000
  if (!isFirebaseConfigured) {
    const all = lsRead(LS.notifications, []).filter((n) => n.ts >= cutoff)
    return {
      global: all.filter((n) => n.scope === 'global').sort((a, b) => b.ts - a.ts).slice(0, max),
      private: all.filter((n) => n.scope === 'private' && (n.targets || []).includes(cur.uid)).sort((a, b) => b.ts - a.ts).slice(0, max),
    }
  }
  const col = collection(db, 'notifications')
  const [g, p] = await Promise.all([
    getDocs(query(col, where('scope', '==', 'global'), qLimit(max))),
    getDocs(query(col, where('targets', 'array-contains', cur.uid), qLimit(max))),
  ])
  const norm = (d) => ({ id: d.id, ...d.data() })
  return {
    global: g.docs.map(norm).filter((n) => n.ts >= cutoff).sort((a, b) => b.ts - a.ts),
    private: p.docs.map(norm).filter((n) => n.ts >= cutoff).sort((a, b) => b.ts - a.ts),
  }
}

export async function markNotificationsRead(scope) {
  const cur = await thisGetCurrent()
  if (!cur) return
  const { global, private: priv } = await listMyNotifications(100)
  const mine = scope === 'global' ? global : scope === 'private' ? priv : [...global, ...priv]
  const unread = mine.filter((n) => !(n.readBy || []).includes(cur.uid))
  if (!isFirebaseConfigured) {
    const all = lsRead(LS.notifications, [])
    for (const n of all) {
      const inScope = scope === 'all' || n.scope === scope
      if (inScope && !(n.readBy || []).includes(cur.uid)) n.readBy = [...(n.readBy || []), cur.uid]
    }
    lsWrite(LS.notifications, all)
    window.dispatchEvent(new Event('ah:notifications'))
    return
  }
  const batch = writeBatch(db)
  for (const n of unread.slice(0, 400)) {
    if (n.id) batch.update(doc(db, 'notifications', n.id), { readBy: arrayUnion(cur.uid) })
  }
  await batch.commit().catch(() => {})
}

export async function unreadNotificationCount() {
  const cur = await thisGetCurrent()
  if (!cur) return 0
  const { global, private: priv } = await listMyNotifications(100)
  return [...global, ...priv].filter((n) => !(n.readBy || []).includes(cur.uid)).length
}

// ════════════════════════════════════════════════════════════════════════════
// SETTINGS / MAINTENANCE (operator)
// ════════════════════════════════════════════════════════════════════════════
export async function getSiteSettings() {
  if (!isFirebaseConfigured) return { maintenance: false, announcement: '', ...lsRead(LS.settings, {}) }
  const snap = await getDoc(doc(db, 'settings', 'global'))
  return snap.exists() ? snap.data() : { maintenance: false, announcement: '' }
}

export async function setSiteSettings(partial) {
  const cur = await thisGetCurrent()
  if (!isOperatorProfile(cur)) throw err('Only the operator can change site settings.')
  if (!isFirebaseConfigured) {
    const next = { ...lsRead(LS.settings, {}), ...partial, updatedAt: now() }
    lsWrite(LS.settings, next)
    window.dispatchEvent(new Event('ah:settings'))
    return next
  }
  await setDoc(doc(db, 'settings', 'global'), { ...partial, updatedAt: now() }, { merge: true })
  return getSiteSettings()
}

// ════════════════════════════════════════════════════════════════════════════
// CONTACT
// ════════════════════════════════════════════════════════════════════════════
export async function saveContactMessage({ name, email, subject, message }) {
  const doc_ = {
    name: String(name || '').slice(0, 120), email: String(email || '').slice(0, 200),
    subject: String(subject || '').slice(0, 160), message: String(message || '').slice(0, 2000),
    ts: now(),
  }
  const cur = await thisGetCurrent().catch(() => null)
  if (cur) doc_.uid = cur.uid
  if (!isFirebaseConfigured) {
    const all = lsRead(LS.contact, [])
    all.unshift({ id: uid(), ...doc_ })
    lsWrite(LS.contact, all.slice(0, 200))
    return doc_
  }
  await addDoc(collection(db, 'contactMessages'), doc_)
  return doc_
}

// ════════════════════════════════════════════════════════════════════════════
// ADMIN (operator only — enforced by UI + Firestore rules)
// ════════════════════════════════════════════════════════════════════════════
async function requireOperator() {
  const cur = await thisGetCurrent()
  if (!isOperatorProfile(cur)) throw err('This area is restricted to the operator.')
  return cur
}

export async function adminListUsers({ search = '', max = 60 } = {}) {
  await requireOperator()
  const qtext = String(search || '').trim().toLowerCase()
  if (!isFirebaseConfigured) {
    let users = Object.values(lsUsers()).map(publicProfile)
    if (qtext) users = users.filter((u) => u.username.includes(qtext) || (u.email || '').includes(qtext))
    return users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, max)
  }
  if (qtext) {
    const snap = await getDocs(query(collection(db, 'usernames'), where('__name__', '>=', qtext), where('__name__', '<=', qtext + ''), qLimit(max)))
    const out = []
    for (const d of snap.docs) { const p = await getProfile(d.data().uid); if (p) out.push(p) }
    return out
  }
  const snap = await getDocs(query(collection(db, 'users'), qLimit(max)))
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

export async function adminSetBanned(uid_, banned) {
  await requireOperator()
  if (!isFirebaseConfigured) {
    const users = lsUsers(); if (users[uid_]) { users[uid_].banned = !!banned; users[uid_].online = !banned }
    lsWrite(LS.users, users); return
  }
  await updateDoc(doc(db, 'users', uid_), { banned: !!banned, ...(banned ? { online: false } : {}) })
}

export async function adminSetMuted(uid_, muted) {
  await requireOperator()
  if (!isFirebaseConfigured) {
    const users = lsUsers(); if (users[uid_]) users[uid_].muted = !!muted
    lsWrite(LS.users, users); return
  }
  await updateDoc(doc(db, 'users', uid_), { muted: !!muted })
}

export async function adminDeleteUser(uid_) {
  await requireOperator()
  if (!isFirebaseConfigured) {
    const users = lsUsers(); const victim = users[uid_]
    delete users[uid_]; lsWrite(LS.users, users)
    if (victim) { const un = lsUsernames(); delete un[victim.username]; lsWrite(LS.usernames, un) }
    const secrets = lsSecrets(); delete secrets[uid_]; lsWrite(LS.secrets, secrets)
    return
  }
  const profile = await getProfile(uid_)
  await deleteDoc(doc(db, 'users', uid_))
  await deleteDoc(doc(db, 'secrets', uid_)).catch(() => {}) // needs service account — handled by server on next login; harmless no-op if denied
  if (profile?.username) await deleteDoc(doc(db, 'usernames', profile.username)).catch(() => {})
  return { note: 'Firestore records deleted. Delete the Firebase Auth user (and any secrets doc) from the Firebase Console, or via the Render service account.' }
}

export async function adminLeaderboardSnapshot() {
  await requireOperator()
  if (!isFirebaseConfigured) {
    const all = lsRead(LS.scores, [])
    const byGame = {}
    for (const s of all) {
      byGame[s.gameId] = byGame[s.gameId] || { entries: 0, plays: 0, top: 0 }
      byGame[s.gameId].entries += 1
      byGame[s.gameId].plays += s.plays || 1
      byGame[s.gameId].top = Math.max(byGame[s.gameId].top, s.best)
    }
    return byGame
  }
  const games = ['flappy', 'snake', 'dino', 'pacman']
  const out = {}
  for (const g of games) {
    const snap = await getDocs(collection(db, 'leaderboards', g, 'entries'))
    const arr = snap.docs.map((d) => d.data())
    out[g] = {
      entries: arr.length,
      plays: arr.reduce((a, b) => a + (b.plays || 0), 0),
      top: arr.reduce((a, b) => Math.max(a, b.best || 0), 0),
    }
  }
  return out
}

export async function adminDeleteLeaderboardEntry(gameId, uid_) {
  await requireOperator()
  if (!isFirebaseConfigured) {
    lsWrite(LS.scores, lsRead(LS.scores, []).filter((s) => !(s.gameId === gameId && s.uid === uid_)))
    return
  }
  await deleteDoc(doc(db, 'leaderboards', gameId, 'entries', uid_))
}

export async function adminClearLeaderboard(gameId) {
  await requireOperator()
  if (!isFirebaseConfigured) {
    lsWrite(LS.scores, lsRead(LS.scores, []).filter((s) => s.gameId !== gameId))
    return
  }
  const snap = await getDocs(collection(db, 'leaderboards', gameId, 'entries'))
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
}

export async function adminFlaggedMessages(max = 50) {
  await requireOperator()
  if (!isFirebaseConfigured) {
    return lsRead(LS.messages, []).filter((m) => m.flagged).sort((a, b) => b.ts - a.ts).slice(0, max)
  }
  try {
    const snap = await getDocs(query(collection(db, 'messages'), where('flagged', '==', true), qLimit(max)))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.ts - a.ts)
  } catch { return [] }
}

export async function adminContactMessages(max = 30) {
  await requireOperator()
  if (!isFirebaseConfigured) return lsRead(LS.contact, []).slice(0, max)
  const snap = await getDocs(query(collection(db, 'contactMessages'), qLimit(max)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.ts - a.ts).slice(0, max)
}

export async function adminStats() {
  await requireOperator()
  if (!isFirebaseConfigured) {
    const users = Object.values(lsUsers())
    const scores = lsRead(LS.scores, [])
    const messages = lsRead(LS.messages, [])
    const cutoff = now() - 24 * 3600 * 1000
    return {
      users: users.length,
      online: users.filter((u) => u.online).length,
      banned: users.filter((u) => u.banned).length,
      plays: scores.reduce((a, s) => a + (s.plays || 0), 0),
      scoreEntries: scores.length,
      messagesToday: messages.filter((m) => m.ts >= cutoff).length,
      flagged: messages.filter((m) => m.flagged).length,
      contact: lsRead(LS.contact, []).length,
    }
  }
  const [usersSnap, msgsSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), qLimit(500))),
    getDocs(query(collection(db, 'messages'), qLimit(300))),
  ])
  const users = usersSnap.docs.map((d) => d.data())
  const msgs = msgsSnap.docs.map((d) => d.data())
  const cutoff = now() - 24 * 3600 * 1000
  const lb = await adminLeaderboardSnapshot()
  return {
    users: users.length,
    online: users.filter((u) => u.online).length,
    banned: users.filter((u) => u.banned).length,
    plays: Object.values(lb).reduce((a, g) => a + g.plays, 0),
    scoreEntries: Object.values(lb).reduce((a, g) => a + g.entries, 0),
    messagesToday: msgs.filter((m) => m.ts >= cutoff).length,
    flagged: msgs.filter((m) => m.flagged).length,
    contact: (await adminContactMessages(100)).length,
  }
}

export { isFirebaseConfigured }

/** Persist an FCM push token against the current user (Firestore arrayUnion). */
export async function saveFcmToken(token) {
  const clean = String(token || '').trim()
  if (!clean) return false
  const cur = await thisGetCurrent()
  if (!cur) return false
  if (!isFirebaseConfigured) return true // demo mode: nowhere to push to
  try {
    await setDoc(doc(db, 'users', cur.uid), { fcmTokens: arrayUnion(clean) }, { merge: true })
    return true
  } catch (err) {
    console.error('[db] saveFcmToken failed:', err)
    return false
  }
}
