// Arcade Hub — validation helpers (username / password / email)
import CryptoJS from 'crypto-js'

// ── Username rules ───────────────────────────────────────────────────────────
// • 3–20 characters
// • lowercase a-z, digits 0-9, and a MAX of ONE underscore
// • may not start or end with an underscore
// • uppercase is silently lowercased by the app before validation
export function normalizeUsername(raw) {
  return String(raw || '').trim().toLowerCase()
}

export function validateUsername(raw) {
  const u = normalizeUsername(raw)
  if (u.length < 3) return { ok: false, error: 'Username must be at least 3 characters long.' }
  if (u.length > 20) return { ok: false, error: 'Username must be at most 20 characters long.' }
  if (!/^[a-z0-9_]+$/.test(u)) {
    return { ok: false, error: 'Only lowercase letters, numbers and a single underscore are allowed.' }
  }
  const underscores = (u.match(/_/g) || []).length
  if (underscores > 1) return { ok: false, error: 'Only one underscore is allowed in a username.' }
  if (u.startsWith('_')) return { ok: false, error: 'Username cannot start with an underscore.' }
  if (u.endsWith('_')) return { ok: false, error: 'Username cannot end with an underscore.' }
  return { ok: true, value: u }
}

export function validateEmail(raw) {
  const email = String(raw || '').trim().toLowerCase()
  // Practical RFC-5322-lite: user@domain.tld
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) {
    return { ok: false, error: 'Enter a valid email address (e.g. name@example.com).' }
  }
  if (email.length > 254) return { ok: false, error: 'Email is too long.' }
  return { ok: true, value: email }
}

export function validatePassword(raw) {
  const pw = String(raw || '')
  if (pw.length < 4) return { ok: false, error: 'Password must be at least 4 characters long.' }
  if (pw.length > 128) return { ok: false, error: 'Password must be at most 128 characters long.' }
  return { ok: true, value: pw }
}

// ── Password hashing ─────────────────────────────────────────────────────────
// New accounts store SHA-256. Legacy accounts imported from the old database
// store SHA-1 (40 hex chars) and are transparently upgraded to SHA-256 on
// their first successful login.
export const sha1 = (text) => CryptoJS.SHA1(text).toString(CryptoJS.enc.Hex)
export const sha256 = (text) => CryptoJS.SHA256(text).toString(CryptoJS.enc.Hex)
export const isSha1Hash = (h) => typeof h === 'string' && /^[a-f0-9]{40}$/i.test(h)
export const isSha256Hash = (h) => typeof h === 'string' && /^[a-f0-9]{64}$/i.test(h)

/**
 * Verify a typed password against a stored hash, supporting both SHA-1 (legacy)
 * and SHA-256 (current). Returns { ok, migratedHash } — when the password was
 * validated with SHA-1, `migratedHash` contains the SHA-256 to persist.
 */
export function verifyPasswordHash(typedPassword, storedHash) {
  if (!storedHash) return { ok: false, migratedHash: null }
  if (isSha1Hash(storedHash)) {
    if (sha1(typedPassword).toLowerCase() === storedHash.toLowerCase()) {
      return { ok: true, migratedHash: sha256(typedPassword) } // upgrade!
    }
    return { ok: false, migratedHash: null }
  }
  if (isSha256Hash(storedHash)) {
    return { ok: sha256(typedPassword).toLowerCase() === storedHash.toLowerCase(), migratedHash: null }
  }
  // Unknown format — fail closed
  return { ok: false, migratedHash: null }
}

// ── Misc ─────────────────────────────────────────────────────────────────────
export function passwordStrength(pw) {
  const p = String(pw || '')
  let score = 0
  if (p.length >= 4) score++
  if (p.length >= 8) score++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++
  if (/\d/.test(p)) score++
  if (/[^a-zA-Z0-9]/.test(p)) score++
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Elite']
  return { score, label: labels[Math.min(score, labels.length - 1)] }
}

export function initialsOf(name) {
  const parts = String(name || '?').trim().split(/[\s_]+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

export function avatarColorFor(name) {
  const palette = ['#FFB400', '#FF4D8D', '#3BD6FF', '#00E0A4', '#B388FF', '#FF8A3D', '#7CF35A', '#FF6B6B']
  let h = 0
  const s = String(name || 'arcade')
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

export function threadIdFor(uidA, uidB) {
  return [uidA, uidB].sort().join('::')
}
