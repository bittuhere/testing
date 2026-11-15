// Arcade Hub — chat abuse / profanity filter
// Normalizes leetspeak & repeated characters, then masks matched words and
// reports them so moderators (admin panel) can review.

const LEET = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g',
  '@': 'a', '$': 's', '!': 'i', '+': 't', '(': 'c', 'ph': 'f', 'vv': 'w',
}

const BANNED = [
  // English profanity & slurs (common forms; normalizer catches variants)
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit', 'bitch', 'bitches',
  'asshole', 'arsehole', 'bastard', 'dick', 'dickhead', 'pussy', 'whore', 'slut',
  'cunt', 'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'rape', 'rapist',
  'nazi', 'dyke', 'kike', 'spic', 'chink', 'paki', 'wop', 'gook', 'coon',
  'porn', 'pornhub', 'hentai', 'blowjob', 'handjob', 'anal', 'cum', 'semen', 'boobs',
  'xvideos', 'xnxx', 'sex', 'sexy', 'masturbate', 'dildo', 'vagina',
  // Hindi / Hinglish (transliterated) abusives
  'chutiya', 'madarchod', 'behenchod', 'bhenchod', 'bhosdike', 'bhosadi', 'gandu',
  'gaandu', 'harami', 'haramzada', 'lauda', 'loda', 'lukka', 'randi', 'saala',
  'saaley', 'kutta', 'kamina', 'kameena', 'chodu', 'chodna', 'bhadwa', 'bhadwe',
  'teri maa', 'teri behen', 'gaand', 'lund', 'tatte', 'jhant',
]

const BANNED_PATTERNS = BANNED.map((w) =>
  new RegExp(`\\b${w.replace(/\s+/g, '\\s*')}\\b`, 'i')
)

function normalize(text) {
  let t = String(text || '').toLowerCase()
  // collapse separators people use to dodge filters: f.u.c.k / f_u_c_k / f-u-c-k
  t = t.replace(/([a-z])[\s._\-*·•]+(?=[a-z])/g, '$1')
  // leetspeak decode
  t = t.replace(/ph/g, 'f').replace(/vv/g, 'w')
  t = t.replace(/[01345789@$!+(]/g, (ch) => LEET[ch] || ch)
  // collapse repeated characters: fuuuuck -> fuck
  t = t.replace(/(.)\1{2,}/g, '$1$1').replace(/(.)\1/g, '$1')
  return t
}

/** Mask the banned words inside the ORIGINAL text with asterisks. */
function maskOriginal(original, normalized) {
  let masked = original
  const hits = []
  for (let i = 0; i < BANNED.length; i++) {
    const word = BANNED[i]
    const re = new RegExp(`(^|[^a-z0-9])(${word.replace(/\s+/g, '[^a-z0-9]*')})(?=$|[^a-z0-9])`, 'gi')
    if (re.test(normalized)) {
      hits.push(word)
      const star = '*'.repeat(Math.max(4, word.replace(/\s/g, '').length))
      masked = masked.replace(
        new RegExp(word.replace(/\s+/g, '[^a-zA-Z0-9]*'), 'gi'),
        star
      )
    }
  }
  return { masked, hits }
}

/**
 * Scan a message. Returns { clean, flagged, hits, masked }.
 * `clean` = text safe to display, `flagged` = should be stored for moderator review.
 */
export function filterMessage(text) {
  const original = String(text || '')
  const normalized = normalize(original)
  const { hits } = maskOriginal(original, normalized)
  if (hits.length === 0) return { clean: original, flagged: false, hits: [], masked: original }
  const { masked } = maskOriginal(original, normalized)
  return { clean: masked, flagged: true, hits, masked }
}

export function containsAbuse(text) {
  return filterMessage(text).flagged
}
