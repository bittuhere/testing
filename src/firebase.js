// Arcade Hub — Firebase initialization (only when configured)
// One single Firebase copy lives in this bundle (npm firebase). Never mix it
// with the CDN <script> build — two copies = separate component registries,
// which is exactly what throws "Component auth has not been registered yet".
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics, isSupported as analyticsSupported } from 'firebase/analytics'
import CONFIG, { isFirebaseConfigured } from './config.js'

let app = null
let auth = null
let db = null
let googleProvider = null
let analytics = null

if (isFirebaseConfigured) {
  app = initializeApp(CONFIG.firebase)
  auth = getAuth(app)
  db = getFirestore(app)
  googleProvider = new GoogleAuthProvider()
  googleProvider.setCustomParameters({ prompt: 'select_account' })
  // Analytics: opt-out-safe — only when measurementId is set and the browser
  // supports it (blocked by ad-blockers/SSR otherwise). Never throws.
  if (CONFIG.firebase.measurementId) {
    analyticsSupported()
      .then((ok) => { if (ok) analytics = getAnalytics(app) })
      .catch(() => { /* analytics unavailable (ad-blocker) — app continues */ })
  }
}

export { app, auth, db, googleProvider, analytics, isFirebaseConfigured }

